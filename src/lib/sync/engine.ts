// Moteur de synchronisation : chaque élément (persona, événement, tâche…) devient un
// enregistrement chiffré « collection:id ». Le plus récent gagne, élément par élément.
import { create } from "zustand";
import { useApp, type Collection, type Data } from "../../store/store";
import { authToken, b64u, DEFAULT_SERVER, encodeInvite, importKey, open, randomId, seal, unb64u, type Invite } from "./crypto";

export const SYNC_COLLECTIONS: Collection[] = [
  "personas", "events", "patterns", "leaves", "todos", "shopping", "deliveries", "meals", "money", "projects", "calendars",
];

const LS = "nadendar-sync";
const MAX_BLOB = 60_000;

interface Config {
  server: string;
  hid: string;
  key: string;
  name: string;
  /** Dernier numéro de séquence reçu du serveur. */
  seq: number;
  /** Date de dernière modification connue de chaque enregistrement. */
  meta: Record<string, number>;
  /** Changements locaux pas encore envoyés (survit à la fermeture de l'app). */
  outbox: Record<string, { updatedAt: number; deleted: boolean }>;
  /** Identifiant anonyme côté serveur → identifiant local (« collection:id »). */
  idMap?: Record<string, string>;
}

export type SyncStatus = "off" | "connecting" | "online" | "offline" | "error";

export const useSync = create<{ status: SyncStatus; name?: string; peers: number; lastSync?: number; error?: string; pending: number }>(() => ({
  status: "off",
  peers: 0,
  pending: 0,
}));

let cfg: Config | null = null;
let key: CryptoKey | null = null;
let token = "";
let ws: WebSocket | null = null;
let applying = false;
let unsub: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let retry = 2000;
let pushing = false;
let pullAgain = false;
let pulling = false;

// Instantané : un JSON par enregistrement, recalculé seulement pour les listes modifiées.
let snap = new Map<string, string>();
let refs: Partial<Record<Collection, unknown>> = {};

const save = () => {
  if (cfg) localStorage.setItem(LS, JSON.stringify(cfg));
  useSync.setState({ pending: cfg ? Object.keys(cfg.outbox).length : 0 });
};
const recId = (c: Collection, id: string) => `${c}:${id}`;
const splitId = (r: string) => {
  const i = r.indexOf(":");
  return [r.slice(0, i) as Collection, r.slice(i + 1)] as const;
};

/**
 * Identifiant envoyé au serveur : empreinte de la clé du foyer et de l'identifiant local.
 * Le serveur ne sait ni de quoi il s'agit (événement, tâche…) ni d'où vient l'élément.
 */
async function serverId(local: string): Promise<string> {
  const data = new Uint8Array([...unb64u(cfg!.key), ...new TextEncoder().encode(`id:${local}`)]);
  const sid = b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", data))).slice(0, 32);
  (cfg!.idMap ??= {})[sid] = local;
  return sid;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${cfg!.server}/h/${cfg!.hid}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status });
  return body as T;
}

function refreshSnapshot(state = useApp.getState(), only?: Collection[]) {
  for (const c of only ?? SYNC_COLLECTIONS) {
    const list = state[c] as { id: string }[];
    refs[c] = list;
    for (const k of [...snap.keys()]) if (k.startsWith(`${c}:`)) snap.delete(k);
    for (const item of list) snap.set(recId(c, item.id), JSON.stringify(item));
  }
}

/** Détecte les ajouts, modifications et suppressions locales. */
function onStoreChange(state: ReturnType<typeof useApp.getState>) {
  if (!cfg) return;
  const changed = SYNC_COLLECTIONS.filter((c) => state[c] !== refs[c]);
  if (!changed.length) return;
  if (applying) {
    refreshSnapshot(state, changed);
    return;
  }
  const now = Date.now();
  for (const c of changed) {
    const list = state[c] as { id: string }[];
    const seen = new Set<string>();
    for (const item of list) {
      const id = recId(c, item.id);
      seen.add(id);
      const j = JSON.stringify(item);
      if (snap.get(id) !== j) {
        snap.set(id, j);
        mark(id, false, now);
      }
    }
    for (const id of [...snap.keys()]) {
      if (id.startsWith(`${c}:`) && !seen.has(id)) {
        snap.delete(id);
        mark(id, true, now);
      }
    }
    refs[c] = list;
  }
  save();
  schedulePush();
}

function mark(id: string, deleted: boolean, at = Date.now()) {
  cfg!.meta[id] = at;
  cfg!.outbox[id] = { updatedAt: at, deleted };
}

function schedulePush(delay = 700) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, delay);
}

async function push(): Promise<void> {
  if (!cfg || !key || pushing) return;
  const entries = Object.entries(cfg.outbox).slice(0, 200);
  if (!entries.length) return;
  pushing = true;
  try {
    const state = useApp.getState();
    const records = [];
    for (const [id, o] of entries) {
      const [c, itemId] = splitId(id);
      const item = (state[c] as { id: string }[] | undefined)?.find((x) => x.id === itemId);
      const sid = await serverId(id);
      if (o.deleted || !item) {
        records.push({ id: sid, updatedAt: o.updatedAt, deleted: true });
        continue;
      }
      const blob = await seal(key, { c, v: item });
      if (blob.length > MAX_BLOB) {
        // Trop volumineux pour une seule entrée : on le garde localement et on le signale.
        delete cfg.outbox[id];
        useSync.setState({ error: `« ${(item as { title?: string; name?: string }).title ?? (item as { name?: string }).name ?? id} » est trop volumineux pour être synchronisé.` });
        continue;
      }
      records.push({ id: sid, updatedAt: o.updatedAt, blob });
    }
    await api("/push", { method: "POST", body: JSON.stringify({ records }) });
    for (const [id, o] of entries) if (cfg.outbox[id]?.updatedAt === o.updatedAt) delete cfg.outbox[id];
    save();
    useSync.setState({ status: "online", lastSync: Date.now(), error: useSync.getState().error });
    retry = 2000;
    if (Object.keys(cfg.outbox).length) schedulePush(50);
  } catch (e) {
    handleError(e);
    schedulePush(15_000);
  } finally {
    pushing = false;
  }
}

/** Applique les changements des autres appareils. */
export async function pull(): Promise<void> {
  if (!cfg || !key) return;
  if (pulling) {
    pullAgain = true;
    return;
  }
  pulling = true;
  try {
    let more = true;
    while (more && cfg) {
      const res = await api<{ records: { id: string; updatedAt: number; deleted: boolean; blob?: string }[]; seq: number; more: boolean }>(
        `/pull?since=${cfg.seq}&limit=500`,
      );
      const upserts = new Map<Collection, Map<string, unknown>>();
      const removals = new Map<Collection, Set<string>>();
      cfg.idMap ??= {};
      for (const r of res.records) {
        let local = cfg.idMap[r.id];
        let item: { id: string } | undefined;
        if (!r.deleted) {
          try {
            const { c, v } = await open<{ c: Collection; v: { id: string } }>(key, r.blob!);
            local = recId(c, v.id);
            cfg.idMap[r.id] = local;
            item = v;
          } catch {
            continue; // blob illisible (autre clé) : ignoré
          }
        }
        if (!local) continue; // suppression d'un élément jamais vu ici
        if ((cfg.meta[local] ?? 0) >= r.updatedAt) continue; // notre version est plus récente
        const [c, itemId] = splitId(local);
        if (!SYNC_COLLECTIONS.includes(c)) continue;
        if (r.deleted) {
          if (!removals.has(c)) removals.set(c, new Set());
          removals.get(c)!.add(itemId);
        } else {
          if (!upserts.has(c)) upserts.set(c, new Map());
          upserts.get(c)!.set(itemId, item);
        }
        cfg.meta[local] = r.updatedAt;
        if (cfg.outbox[local] && cfg.outbox[local].updatedAt < r.updatedAt) delete cfg.outbox[local];
      }
      if (upserts.size || removals.size) {
        applying = true;
        try {
          useApp.setState((s) => {
            const patch: Partial<Data> = {};
            for (const c of new Set([...upserts.keys(), ...removals.keys()])) {
              const up = upserts.get(c) ?? new Map();
              const rm = removals.get(c) ?? new Set();
              const list = (s[c] as { id: string }[]).filter((x) => !rm.has(x.id)).map((x) => (up.has(x.id) ? up.get(x.id) : x));
              for (const [id, v] of up) if (!list.some((x) => (x as { id: string }).id === id)) list.push(v as { id: string });
              (patch as Record<string, unknown>)[c] = list;
            }
            return patch;
          });
        } finally {
          applying = false;
        }
      }
      cfg.seq = res.seq;
      more = res.more;
      save();
    }
    useSync.setState({ status: "online", lastSync: Date.now() });
    retry = 2000;
  } catch (e) {
    handleError(e);
  } finally {
    pulling = false;
    if (pullAgain) {
      pullAgain = false;
      pull();
    }
  }
}

function handleError(e: unknown) {
  const status = (e as { status?: number }).status;
  if (status === 403 || status === 404) {
    useSync.setState({ status: "error", error: status === 404 ? "Ce foyer n'existe plus sur le serveur." : "Ce code d'accès n'est plus valide." });
    return;
  }
  if (status === 507) {
    useSync.setState({ status: "error", error: "Quota du foyer atteint sur le serveur." });
    return;
  }
  useSync.setState({ status: "offline", error: undefined });
}

function connectWs() {
  if (!cfg) return;
  const url = `${cfg.server.replace(/^http/, "ws")}/h/${cfg.hid}/ws?token=${token}`;
  const sock = new WebSocket(url);
  ws = sock;
  sock.onopen = () => {
    retry = 2000;
    useSync.setState({ status: "online" });
    clearInterval(pingTimer);
    pingTimer = setInterval(() => sock.readyState === WebSocket.OPEN && sock.send("ping"), 25_000);
  };
  sock.onmessage = (e) => {
    if (e.data === "pong") return;
    const m = JSON.parse(e.data);
    if (m.type === "seq" && cfg && m.seq > cfg.seq) pull();
    if (m.type === "peers") useSync.setState({ peers: m.n });
    if (m.type === "deleted") useSync.setState({ status: "error", error: "Ce foyer a été supprimé du serveur." });
  };
  sock.onclose = () => {
    clearInterval(pingTimer);
    if (ws !== sock || !cfg) return;
    if (useSync.getState().status !== "error") useSync.setState({ status: "offline", peers: 0 });
    setTimeout(() => ws === sock && cfg && connectWs(), retry);
    retry = Math.min(retry * 2, 30_000);
  };
}

const onWake = () => {
  pull();
  schedulePush(100);
};

/** Démarre la synchronisation si l'appareil est relié à un foyer. */
export async function startSync() {
  stopSync();
  const raw = localStorage.getItem(LS);
  if (!raw) return;
  cfg = JSON.parse(raw) as Config;
  cfg.meta ??= {};
  cfg.outbox ??= {};
  key = await importKey(cfg.key);
  token = await authToken(cfg.key);
  useSync.setState({ status: "connecting", name: cfg.name, error: undefined, pending: Object.keys(cfg.outbox).length });
  refreshSnapshot();
  unsub = useApp.subscribe(onStoreChange);
  try {
    await api("/register", { method: "POST" });
  } catch (e) {
    handleError(e);
  }
  await pull();
  schedulePush(200);
  connectWs();
  pollTimer = setInterval(onWake, 60_000);
  window.addEventListener("online", onWake);
  window.addEventListener("focus", onWake);
}

export function stopSync() {
  unsub?.();
  unsub = null;
  clearTimeout(pushTimer);
  clearInterval(pollTimer);
  clearInterval(pingTimer);
  window.removeEventListener("online", onWake);
  window.removeEventListener("focus", onWake);
  const s = ws;
  ws = null;
  s?.close();
  cfg = null;
  key = null;
  snap = new Map();
  refs = {};
}

/** Crée un foyer à partir des données de cet appareil. */
export async function createHousehold(name: string, server = DEFAULT_SERVER) {
  const conf: Config = { server, hid: randomId(16), key: randomId(32), name: name.trim() || "Mon foyer", seq: 0, meta: {}, outbox: {} };
  // Tout ce qui existe déjà part vers le serveur.
  const state = useApp.getState();
  const now = Date.now();
  for (const c of SYNC_COLLECTIONS) for (const item of state[c] as { id: string }[]) {
    conf.meta[recId(c, item.id)] = now;
    conf.outbox[recId(c, item.id)] = { updatedAt: now, deleted: false };
  }
  localStorage.setItem(LS, JSON.stringify(conf));
  await startSync();
}

/** Rejoint un foyer existant. `replace` : les données locales sont remplacées par celles du foyer. */
export async function joinHousehold(invite: Invite, replace: boolean) {
  const conf: Config = { server: invite.server ?? DEFAULT_SERVER, hid: invite.hid, key: invite.key, name: invite.name, seq: 0, meta: {}, outbox: {} };
  // Vérifie d'abord que le foyer existe et que la clé est la bonne.
  const t = await authToken(invite.key);
  const res = await fetch(`${conf.server}/h/${conf.hid}/pull?since=0&limit=1`, { headers: { Authorization: `Bearer ${t}` } });
  if (res.status === 404) throw new Error("Foyer introuvable : vérifie le code.");
  if (res.status === 403) throw new Error("Code invalide pour ce foyer.");
  if (!res.ok) throw new Error(`Serveur injoignable (${res.status}).`);
  if (replace) {
    applying = true;
    try {
      useApp.setState(Object.fromEntries(SYNC_COLLECTIONS.map((c) => [c, []])) as Partial<Data>);
    } finally {
      applying = false;
    }
  } else {
    // Les éléments locaux rejoignent le foyer.
    const state = useApp.getState();
    const now = Date.now();
    for (const c of SYNC_COLLECTIONS) for (const item of state[c] as { id: string }[]) {
      conf.meta[recId(c, item.id)] = now;
      conf.outbox[recId(c, item.id)] = { updatedAt: now, deleted: false };
    }
  }
  localStorage.setItem(LS, JSON.stringify(conf));
  useApp.getState().setSettings({ onboarded: true });
  await startSync();
}

/** Quitte le foyer : les données restent sur cet appareil. */
export function leaveHousehold() {
  stopSync();
  localStorage.removeItem(LS);
  useSync.setState({ status: "off", name: undefined, peers: 0, error: undefined, pending: 0 });
}

/** Supprime le foyer et toutes ses données du serveur (droit à l'effacement). */
export async function deleteHousehold() {
  if (cfg) await api("", { method: "DELETE" }).catch(() => {});
  leaveHousehold();
}

export function currentInvite(): string | null {
  if (!cfg) return null;
  return encodeInvite({ hid: cfg.hid, key: cfg.key, name: cfg.name, server: cfg.server });
}

export const syncNow = () => {
  pull();
  schedulePush(0);
};
