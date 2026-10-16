// Petites passerelles vers Tauri, avec repli navigateur (aperçu en `pnpm dev`).

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Applique le thème au document et à la fenêtre native (barre de titre, fond au redimensionnement). */
export async function applyTheme(light: boolean) {
  const root = document.documentElement;
  root.classList.toggle("theme-light", light);
  root.classList.toggle("theme-nads", !light);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#f2f2f4" : "#111113");
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    await w.setTheme(light ? "light" : "dark");
    await w.setBackgroundColor(light ? "#f2f2f4" : "#111113");
  } catch {
    // Non pris en charge sur cette plateforme (Android) : sans conséquence.
  }
}

export async function openExternal(url: string) {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

export async function notify(title: string, body: string) {
  if (isTauri()) {
    const n = await import("@tauri-apps/plugin-notification");
    let ok = await n.isPermissionGranted();
    if (!ok) ok = (await n.requestPermission()) === "granted";
    if (ok) n.sendNotification({ title, body });
    return;
  }
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission === "granted") new Notification(title, { body, icon: "/icon.svg" });
}

export async function saveBackupFile(json: string): Promise<string | null> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("save_backup", { json });
  }
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nadendar-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  return null;
}

/** Enregistre un fichier exporté (Téléchargements sur PC/Android) puis l'ouvre. */
export async function saveExport(name: string, bytes: Uint8Array, mime = "application/pdf"): Promise<string | null> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string>("save_export", bytes, { headers: { "x-file-name": encodeURIComponent(name) } });
    try {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(path);
    } catch {
      // Pas de lecteur PDF : le fichier reste dans Téléchargements.
    }
    return path;
  }
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return null;
}
