// Nadendar Sync — serveur de synchronisation chiffrée de bout en bout.
//
// Le serveur ne voit jamais les données en clair : chaque appareil chiffre ses éléments
// (AES-GCM) avec la clé du foyer, transmise uniquement par le code d'invitation. Ici on
// stocke des enregistrements opaques, on garde le plus récent (dernier écrit gagne), et on
// prévient les autres appareils du foyer par WebSocket.
//
// Routes (servies derrière Nginx sous https://nads.site/sync/) :
//   GET    /health
//   POST   /h/:hid/register   crée le foyer (ou vérifie le jeton s'il existe)
//   POST   /h/:hid/push       envoie des enregistrements
//   GET    /h/:hid/pull       récupère ceux modifiés depuis ?since=
//   GET    /h/:hid/ws         notifications en direct (?token=)
//   DELETE /h/:hid            efface le foyer et toutes ses données

const kv = await Deno.openKv(Deno.env.get("DENO_KV_PATH") ?? "sync.db");
const PORT = Number(Deno.env.get("PORT") ?? 8787);
const HOST = Deno.env.get("HOST") ?? "127.0.0.1";

// Limites par foyer et par requête.
const MAX_RECORDS = 20_000;
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_BLOB = 60_000; // une valeur Deno KV fait au plus 64 Ko
const MAX_BATCH = 500;
const MAX_BODY = 6 * 1024 * 1024;
const RATE_PER_MIN = 240;

const HID = /^[A-Za-z0-9_-]{22}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

interface Meta {
  tokenHash: string;
  seq: number;
  records: number;
  bytes: number;
  createdAt: number;
}

interface Rec {
  updatedAt: number;
  deleted: boolean;
  blob?: string;
  seq: number;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (status: number, error: string) => json({ error }, status);

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparaison en temps constant de deux empreintes hexadécimales. */
function sameHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ── Limite de débit par adresse IP (fenêtre glissante d'une minute) ─────────
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_PER_MIN;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, l] of hits) if (!l.some((t) => now - t < 60_000)) hits.delete(ip);
}, 120_000);

// ── Une écriture à la fois par foyer (le numéro de séquence reste continu) ──
const locks = new Map<string, Promise<unknown>>();
function serial<T>(hid: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(hid) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(hid, next.catch(() => {}));
  return next;
}

// ── Appareils connectés en direct, par foyer ────────────────────────────────
const sockets = new Map<string, Set<WebSocket>>();
function broadcast(hid: string, msg: unknown, except?: WebSocket) {
  const set = sockets.get(hid);
  if (!set) return;
  const data = JSON.stringify(msg);
  for (const ws of set) if (ws !== except && ws.readyState === WebSocket.OPEN) ws.send(data);
}
const peers = (hid: string) => broadcast(hid, { type: "peers", n: sockets.get(hid)?.size ?? 0 });

const metaKey = (hid: string) => ["h", hid, "meta"];

async function authorize(hid: string, token: string | null): Promise<Meta | Response> {
  if (!token || !TOKEN.test(token)) return fail(401, "jeton manquant");
  const meta = (await kv.get<Meta>(metaKey(hid))).value;
  if (!meta) return fail(404, "foyer inconnu");
  if (!sameHash(meta.tokenHash, await sha256(token))) return fail(403, "jeton invalide");
  return meta;
}

const bearer = (req: Request) => req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;

async function register(hid: string, token: string | null) {
  if (!token || !TOKEN.test(token)) return fail(400, "jeton invalide");
  const tokenHash = await sha256(token);
  return serial(hid, async () => {
    const cur = await kv.get<Meta>(metaKey(hid));
    if (cur.value) return sameHash(cur.value.tokenHash, tokenHash) ? json({ ok: true, seq: cur.value.seq }) : fail(409, "foyer déjà pris");
    const meta: Meta = { tokenHash, seq: 0, records: 0, bytes: 0, createdAt: Date.now() };
    const r = await kv.atomic().check(cur).set(metaKey(hid), meta).commit();
    return r.ok ? json({ ok: true, seq: 0 }) : fail(409, "conflit");
  });
}

interface InRec {
  id: string;
  updatedAt: number;
  deleted?: boolean;
  blob?: string;
}

function valid(r: InRec) {
  return (
    typeof r?.id === "string" && r.id.length > 0 && r.id.length <= 200 &&
    Number.isFinite(r.updatedAt) && r.updatedAt > 0 &&
    (r.deleted === true || (typeof r.blob === "string" && r.blob.length <= MAX_BLOB))
  );
}

async function push(hid: string, req: Request) {
  const len = Number(req.headers.get("Content-Length") ?? 0);
  if (len > MAX_BODY) return fail(413, "envoi trop volumineux");
  let body: { records?: InRec[] };
  try {
    body = await req.json();
  } catch {
    return fail(400, "JSON invalide");
  }
  const records = body.records;
  if (!Array.isArray(records) || records.length > MAX_BATCH) return fail(400, `entre 0 et ${MAX_BATCH} enregistrements`);
  if (!records.every(valid)) return fail(400, "enregistrement invalide");

  return serial(hid, async () => {
    const meta = (await kv.get<Meta>(metaKey(hid))).value!;
    let accepted = 0;
    for (const r of records) {
      const key = ["h", hid, "r", r.id];
      const old = (await kv.get<Rec>(key)).value;
      // Dernier écrit gagne : un enregistrement plus ancien que celui du serveur est ignoré.
      if (old && old.updatedAt >= r.updatedAt) continue;
      const size = r.deleted ? 0 : r.blob!.length;
      const nextRecords = meta.records + (old ? 0 : 1);
      const nextBytes = meta.bytes - (old?.blob?.length ?? 0) + size;
      if (nextRecords > MAX_RECORDS || nextBytes > MAX_BYTES) return fail(507, "quota du foyer atteint");
      meta.seq += 1;
      meta.records = nextRecords;
      meta.bytes = nextBytes;
      const rec: Rec = { updatedAt: r.updatedAt, deleted: !!r.deleted, blob: r.deleted ? undefined : r.blob, seq: meta.seq };
      const op = kv.atomic().set(key, rec).set(["h", hid, "s", meta.seq], r.id).set(metaKey(hid), meta);
      if (old) op.delete(["h", hid, "s", old.seq]);
      await op.commit();
      accepted++;
    }
    if (accepted) broadcast(hid, { type: "seq", seq: meta.seq });
    return json({ ok: true, accepted, seq: meta.seq });
  });
}

async function pull(hid: string, url: URL, meta: Meta) {
  const since = Math.max(0, Number(url.searchParams.get("since") ?? 0) | 0);
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") ?? 500) | 0));
  const ids: { seq: number; id: string }[] = [];
  for await (const e of kv.list<string>({ start: ["h", hid, "s", since + 1], end: ["h", hid, "s", Number.MAX_SAFE_INTEGER] }, { limit })) {
    ids.push({ seq: e.key[3] as number, id: e.value });
  }
  const out: (Rec & { id: string })[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const got = await kv.getMany<Rec[]>(chunk.map((x) => ["h", hid, "r", x.id]));
    got.forEach((g, k) => g.value && out.push({ id: chunk[k].id, ...g.value }));
  }
  const last = ids.length ? ids[ids.length - 1].seq : since;
  return json({ records: out, seq: last, head: meta.seq, more: last < meta.seq });
}

async function destroy(hid: string) {
  return serial(hid, async () => {
    let n = 0;
    let op = kv.atomic();
    for await (const e of kv.list({ prefix: ["h", hid] })) {
      op.delete(e.key);
      if (++n % 500 === 0) {
        await op.commit();
        op = kv.atomic();
      }
    }
    await op.commit();
    broadcast(hid, { type: "deleted" });
    for (const ws of sockets.get(hid) ?? []) ws.close(4001, "foyer supprimé");
    return json({ ok: true, deleted: n });
  });
}

Deno.serve({ port: PORT, hostname: HOST }, async (req, info) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const ip = req.headers.get("X-Real-IP") ?? (info.remoteAddr as Deno.NetAddr).hostname;
  if (limited(ip)) return fail(429, "trop de requêtes");

  if (url.pathname === "/health") return json({ ok: true, service: "nadendar-sync" });

  const m = url.pathname.match(/^\/h\/([^/]+)(?:\/(register|push|pull|ws))?$/);
  if (!m || !HID.test(m[1])) return fail(404, "introuvable");
  const [, hid, action] = m;

  try {
    if (action === "register" && req.method === "POST") return await register(hid, bearer(req));

    if (action === "ws") {
      const meta = await authorize(hid, url.searchParams.get("token"));
      if (meta instanceof Response) return meta;
      if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") return fail(426, "WebSocket attendu");
      const { socket, response } = Deno.upgradeWebSocket(req, { idleTimeout: 60 });
      socket.onopen = () => {
        if (!sockets.has(hid)) sockets.set(hid, new Set());
        sockets.get(hid)!.add(socket);
        socket.send(JSON.stringify({ type: "seq", seq: meta.seq }));
        peers(hid);
      };
      socket.onclose = () => {
        sockets.get(hid)?.delete(socket);
        if (!sockets.get(hid)?.size) sockets.delete(hid);
        peers(hid);
      };
      socket.onmessage = (e) => e.data === "ping" && socket.send("pong");
      return response;
    }

    const meta = await authorize(hid, bearer(req));
    if (meta instanceof Response) return meta;
    if (action === "push" && req.method === "POST") return await push(hid, req);
    if (action === "pull" && req.method === "GET") return await pull(hid, url, meta);
    if (!action && req.method === "DELETE") return await destroy(hid);
    return fail(405, "méthode non permise");
  } catch (e) {
    console.error(e);
    return fail(500, "erreur serveur");
  }
});

console.log(`nadendar-sync en écoute sur http://${HOST}:${PORT}`);
