import { AnimatePresence, motion } from "framer-motion";
import { Download, Gift, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { openExternal } from "../lib/platform";
import { APP_VERSION, CHANGELOG, isNewer, RELEASES_URL, skipUpdate, useUpdate } from "../lib/updates";
import { useApp } from "../store/store";
import { Button, Modal } from "./ui/ui";

const SIX_HOURS = 6 * 3600 * 1000;

/** Carte « nouvelle version disponible », vérifiée au lancement puis toutes les 6 h. */
export function UpdateNotice() {
  const update = useUpdate((s) => s.update);
  const check = useUpdate((s) => s.check);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const first = window.setTimeout(() => check(), 5000);
    const every = window.setInterval(() => check(), SIX_HOURS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [check]);

  const run = async () => {
    if (!update) return;
    if (!update.install) {
      if (update.url) openExternal(update.url);
      return;
    }
    setError("");
    setProgress(0);
    try {
      await update.install(setProgress);
    } catch (e) {
      setProgress(null);
      setError(`Mise à jour automatique impossible (${e instanceof Error ? e.message : e}). Téléchargez-la depuis la page des versions.`);
      // Ex. paquet .deb ou .rpm : on bascule sur le téléchargement manuel.
      useUpdate.setState({ update: { ...update, install: undefined, url: RELEASES_URL } });
    }
  };

  return (
    <AnimatePresence>
      {update && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="fixed bottom-16 right-3 z-[60] w-[min(340px,calc(100vw-24px))] rounded-2xl border border-line bg-panel p-3.5 shadow-2xl md:bottom-10"
          role="status"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
              <Gift size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-bright">Nadendar {update.version} est disponible</p>
              <p className="mt-0.5 text-[12px] text-muted">
                Vous avez la {APP_VERSION}. {update.install ? "Installation en un clic, vos données sont conservées." : "Téléchargez et installez la nouvelle version, vos données sont conservées."}
              </p>
            </div>
            {progress === null && (
              <button className="text-faint hover:text-fg cursor-pointer" onClick={() => skipUpdate(update.version)} aria-label="Plus tard">
                <X size={16} />
              </button>
            )}
          </div>
          {progress !== null ? (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-elev">
                <motion.div className="h-full bg-brand" animate={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mt-1.5 text-[11.5px] text-muted">{progress < 1 ? `Téléchargement… ${Math.round(progress * 100)} %` : "Installation, Nadendar va redémarrer…"}</p>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="primary" icon={Download} onClick={run}>
                {update.install ? "Mettre à jour" : "Télécharger"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => skipUpdate(update.version)}>
                Plus tard
              </Button>
            </div>
          )}
          {error && <p className="mt-2 text-[11.5px] text-bad">{error}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Bouton « Rechercher une mise à jour » des Réglages. */
export function UpdateCheckButton() {
  const check = useUpdate((s) => s.check);
  const checking = useUpdate((s) => s.checking);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        icon={RefreshCw}
        disabled={checking}
        onClick={async () => {
          setMsg("");
          const u = await check(true);
          const err = useUpdate.getState().lastError;
          setMsg(err ? "Impossible de vérifier (pas de connexion ?)" : u ? `Version ${u.version} disponible.` : "Nadendar est à jour.");
        }}
      >
        {checking ? "Recherche…" : "Rechercher une mise à jour"}
      </Button>
      {msg && <span className="text-[12px] text-muted">{msg}</span>}
    </div>
  );
}

/** Après une mise à jour : ce qui a changé depuis la dernière version vue. */
export function WhatsNew() {
  const onboarded = useApp((s) => s.settings.onboarded);
  const lastSeen = useApp((s) => s.settings.lastSeenVersion);
  const setSettings = useApp((s) => s.setSettings);
  const fresh = !lastSeen || isNewer(APP_VERSION, lastSeen);

  useEffect(() => {
    // Nouvel utilisateur : rien à annoncer.
    if (!onboarded && fresh) setSettings({ lastSeenVersion: APP_VERSION });
  }, [onboarded, fresh, setSettings]);

  const open = onboarded && fresh;
  const entries = CHANGELOG.filter((c) => !isNewer(c.version, APP_VERSION) && (lastSeen ? isNewer(c.version, lastSeen) : c.version === APP_VERSION));
  const close = () => setSettings({ lastSeenVersion: APP_VERSION });

  return (
    <Modal
      open={open && entries.length > 0}
      onClose={close}
      title={`Nouveautés de Nadendar ${APP_VERSION}`}
      icon={Gift}
      width={520}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="primary" onClick={close}>
            C'est parti
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {entries.map((c) => (
          <div key={c.version} className="grid gap-2">
            {entries.length > 1 && <p className="text-[12px] font-semibold uppercase tracking-wide text-faint">Version {c.version}</p>}
            <ul className="grid gap-2">
              {c.items.map((it) => (
                <li key={it} className="flex gap-2.5 text-[13px] leading-snug text-fg">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}
