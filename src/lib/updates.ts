// Mises à jour : installées par l'application sur ordinateur (plugin updater de Tauri, paquets
// signés), proposées en téléchargement sur Android (dernière release GitHub).
import { create } from "zustand";
import { isTauri } from "./platform";

export const APP_VERSION = __APP_VERSION__;
export const RELEASES_URL = "https://github.com/nadsous/nadendar/releases/latest";
const LATEST_API = "https://api.github.com/repos/nadsous/nadendar/releases/latest";

/** Nouveautés montrées après une mise à jour (la plus récente en premier). */
export const CHANGELOG: { version: string; items: string[] }[] = [
  {
    version: "0.1.1",
    items: [
      "Planning scolaire en semaines alternées : A/B, A/B/C ou A/B/C/D. Chaque cours choisit ses semaines, une semaine se copie sur la suivante, et les vacances peuvent ne pas compter dans l'alternance.",
      "La fiche d'un persona ne se fige plus quand on tape son nom ou qu'on change son avatar.",
      "Mises à jour : Nadendar prévient quand une nouvelle version sort. Sur ordinateur, elle s'installe en un clic.",
      "Android : application signée et optimisée, beaucoup plus légère.",
    ],
  },
  {
    version: "0.1.0",
    items: ["Première version publique."],
  },
];

/** a > b, en comparant les versions « 1.2.3 ». */
export function isNewer(a: string, b: string) {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

export const isAndroid = () => /Android/i.test(navigator.userAgent);

export interface UpdateInfo {
  version: string;
  notes: string;
  /** Ordinateur : télécharge, installe puis relance. */
  install?: (progress: (ratio: number) => void) => Promise<void>;
  /** Android, ou repli : page de téléchargement. */
  url?: string;
}

async function fromGitHub(): Promise<UpdateInfo | null> {
  const res = await fetch(LATEST_API, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) return null;
  const j = await res.json();
  const version = String(j.tag_name ?? "").replace(/^v/, "");
  if (!version || !isNewer(version, APP_VERSION)) return null;
  const apk = (j.assets ?? []).find((a: { name: string }) => a.name.endsWith(".apk"));
  return { version, notes: j.body ?? "", url: isAndroid() && apk ? apk.browser_download_url : j.html_url ?? RELEASES_URL };
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  if (isAndroid()) return fromGitHub();
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const u = await check();
    if (!u) return null;
    return {
      version: u.version,
      notes: u.body ?? "",
      install: async (progress) => {
        let total = 0;
        let got = 0;
        await u.downloadAndInstall((e) => {
          if (e.event === "Started") total = e.data.contentLength ?? 0;
          else if (e.event === "Progress") {
            got += e.data.chunkLength;
            if (total) progress(Math.min(1, got / total));
          } else progress(1);
        });
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      },
    };
  } catch {
    // Mise à jour automatique indisponible (paquet .deb/.rpm, réseau…) : on renvoie vers la page.
    return fromGitHub();
  }
}

interface UpdateState {
  update: UpdateInfo | null;
  checking: boolean;
  lastError: string;
  check: (manual?: boolean) => Promise<UpdateInfo | null>;
}

const SKIP_KEY = "nadendar-skip-update";

export const useUpdate = create<UpdateState>((set, get) => ({
  update: null,
  checking: false,
  lastError: "",
  check: async (manual = false) => {
    if (get().checking) return get().update;
    set({ checking: true, lastError: "" });
    try {
      const u = await checkForUpdate();
      // « Plus tard » masque une version jusqu'à la suivante, sauf recherche manuelle.
      const skipped = !manual && u && localStorage.getItem(SKIP_KEY) === u.version;
      set({ update: skipped ? null : u, checking: false });
      return u;
    } catch (e) {
      set({ checking: false, lastError: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },
}));

export const skipUpdate = (version: string) => {
  localStorage.setItem(SKIP_KEY, version);
  useUpdate.setState({ update: null });
};
