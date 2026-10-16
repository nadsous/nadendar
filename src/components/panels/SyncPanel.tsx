import clsx from "clsx";
import { Check, Cloud, CloudOff, Copy, House, LogOut, QrCode, RefreshCw, Trash2, UserPlus } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { fmt } from "../../lib/dates";
import { DEFAULT_SERVER, decodeInvite } from "../../lib/sync/crypto";
import { createHousehold, currentInvite, deleteHousehold, joinHousehold, leaveHousehold, syncNow, useSync, type SyncStatus } from "../../lib/sync/engine";
import { Button, Field, Toggle } from "../ui/ui";

export const STATUS: Record<SyncStatus, { label: string; color: string }> = {
  off: { label: "Local (non partagé)", color: "#8b8b95" },
  connecting: { label: "Connexion…", color: "#fbbf24" },
  online: { label: "Synchronisé", color: "#4ade80" },
  offline: { label: "Hors ligne — en attente", color: "#fbbf24" },
  error: { label: "Erreur de synchronisation", color: "#f87171" },
};

function InviteBox() {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const code = currentInvite();
  useEffect(() => {
    if (code) QRCode.toDataURL(code, { margin: 1, width: 220, errorCorrectionLevel: "M", color: { dark: "#111113", light: "#ffffff" } }).then(setQr);
  }, [code]);
  if (!code) return null;
  return (
    <div className="grid gap-3 rounded-xl border border-line bg-base/50 p-3 sm:grid-cols-[150px_1fr]">
      {qr && <img src={qr} alt="QR code d'invitation" className="h-[150px] w-[150px] rounded-lg" />}
      <div className="grid content-start gap-2">
        <p className="text-[12.5px] text-fg">
          Sur l'autre appareil : <b>Réglages ▸ Foyer ▸ Rejoindre</b>, puis colle ce code (ou scanne le QR code avec l'appareil photo pour le copier).
        </p>
        <code className="break-all rounded-lg bg-elev px-2 py-1.5 text-[11px] text-bright">{code}</code>
        <Button
          size="sm"
          icon={copied ? Check : Copy}
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? "Copié" : "Copier le code"}
        </Button>
        <p className="text-[11px] text-faint">Ce code donne accès à tout le calendrier du foyer : ne le partage qu'avec ta famille.</p>
      </div>
    </div>
  );
}

export function SyncPanel() {
  const sync = useSync();
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [replace, setReplace] = useState(true);
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
      setMode("idle");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sync.status !== "off") {
    const st = STATUS[sync.status];
    return (
      <div className="grid gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-base/50 p-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: st.color + "22", color: st.color }}>
            {sync.status === "offline" || sync.status === "error" ? <CloudOff size={18} /> : <Cloud size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-bright">{sync.name}</div>
            <div className="text-[12px]" style={{ color: st.color }}>
              {st.label}
              {sync.peers > 1 && <span className="text-muted"> · {sync.peers} appareils connectés</span>}
            </div>
            <div className="text-[11.5px] text-faint">
              {sync.lastSync ? `Dernière synchro ${fmt(new Date(sync.lastSync), "HH:mm:ss")}` : "Pas encore synchronisé"}
              {sync.pending > 0 && ` · ${sync.pending} changement${sync.pending > 1 ? "s" : ""} en attente`}
            </div>
          </div>
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={syncNow} title="Synchroniser maintenant" />
        </div>
        {sync.error && <p className="rounded-lg bg-bad/10 px-2.5 py-2 text-[12px] text-bad">{sync.error}</p>}
        <Button icon={showInvite ? QrCode : UserPlus} onClick={() => setShowInvite(!showInvite)}>
          {showInvite ? "Masquer l'invitation" : "Inviter un appareil (téléphone, PC…)"}
        </Button>
        {showInvite && <InviteBox />}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" icon={LogOut} onClick={() => confirm("Quitter le foyer ? Les données restent sur cet appareil, mais ne seront plus partagées.") && leaveHousehold()}>
            Quitter le foyer
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            onClick={() => confirm("Supprimer définitivement le foyer du serveur, pour tous les appareils ? Les données restent sur cet appareil.") && run(deleteHousehold)}
          >
            Supprimer du serveur
          </Button>
        </div>
        <p className="text-[11px] text-faint">Chiffré de bout en bout : le serveur ne stocke que des données illisibles.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-[12.5px] text-muted">
        Partage le calendrier entre ton ordinateur, ton téléphone et ta famille. Les données sont <b className="text-fg">chiffrées sur l'appareil</b> : le serveur ne peut pas les lire.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button icon={House} variant={mode === "create" ? "primary" : "soft"} onClick={() => setMode("create")}>
          Créer un foyer
        </Button>
        <Button icon={UserPlus} variant={mode === "join" ? "primary" : "soft"} onClick={() => setMode("join")}>
          Rejoindre
        </Button>
      </div>

      {mode === "create" && (
        <div className="grid gap-2 rounded-xl border border-line bg-base/50 p-3">
          <Field label="Nom du foyer">
            <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Famille Tounsi" />
          </Field>
          <p className="text-[11.5px] text-faint">Le calendrier de cet appareil devient celui du foyer. Tu pourras ensuite inviter les autres appareils.</p>
          <Button variant="primary" disabled={busy} onClick={() => run(() => createHousehold(name, server))}>
            {busy ? "Création…" : "Créer et partager"}
          </Button>
        </div>
      )}

      {mode === "join" && (
        <div className="grid gap-2 rounded-xl border border-line bg-base/50 p-3">
          <Field label="Code d'invitation" hint="Affiché sur l'appareil qui a créé le foyer : Réglages ▸ Foyer ▸ Inviter.">
            <textarea className="field font-mono text-[11.5px]" rows={3} value={code} onChange={(e) => setCode(e.target.value)} placeholder="NDR1.xxxxxxxx…" />
          </Field>
          <label className="flex items-start gap-3 text-[12.5px]">
            <Toggle on={replace} onChange={setReplace} />
            <span>
              {replace ? "Remplacer les données de cet appareil par celles du foyer" : "Ajouter les données de cet appareil au foyer"}
              <span className="block text-[11px] text-faint">{replace ? "Conseillé pour un nouvel appareil." : "Attention aux doublons si les deux appareils ont les mêmes éléments."}</span>
            </span>
          </label>
          <Button
            variant="primary"
            disabled={busy || !code.trim()}
            onClick={() =>
              run(async () => {
                const inv = decodeInvite(code);
                if (!inv) throw new Error("Code d'invitation illisible.");
                await joinHousehold(inv, replace);
              })
            }
          >
            {busy ? "Connexion…" : "Rejoindre le foyer"}
          </Button>
        </div>
      )}

      {err && <p className="rounded-lg bg-bad/10 px-2.5 py-2 text-[12px] text-bad">{err}</p>}

      {mode === "create" && (
        <details className="text-[11.5px] text-muted">
          <summary className="cursor-pointer">Serveur avancé</summary>
          <input className={clsx("field mt-1.5 text-[12px]")} value={server} onChange={(e) => setServer(e.target.value.replace(/\/+$/, ""))} />
        </details>
      )}
    </div>
  );
}

/** Indicateur de la barre d'état. */
export function SyncBadge() {
  const { status, pending } = useSync();
  const st = STATUS[status];
  return (
    <span className="flex items-center gap-1.5" title={pending ? `${pending} changement(s) en attente` : st.label}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", status === "connecting" && "animate-pulse")} style={{ background: status === "off" ? "#4ade80" : st.color }} />
      {status === "off" ? "Local" : status === "online" ? "Synchronisé" : status === "offline" ? "Hors ligne" : status === "connecting" ? "Connexion…" : "Erreur synchro"}
    </span>
  );
}
