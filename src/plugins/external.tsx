import clsx from "clsx";
import { CalendarSync, Download, FileUp, Link2, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fmt, uid } from "../lib/dates";
import { parseIcs, toIcs } from "../lib/ics";
import { isTauri, saveExport } from "../lib/platform";
import type { CalEvent, ExternalCalendar } from "../lib/types";
import { useApp } from "../store/store";
import { Button, Empty, PALETTE, PersonaSelect } from "../components/ui/ui";
import type { Plugin } from "./types";

const RESYNC = 30 * 60 * 1000;

/** Télécharge un agenda : via Rust dans l'application (pas de CORS), sinon fetch. */
async function fetchText(url: string): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("fetch_ics", { url });
  }
  const res = await fetch(url.replace(/^webcal:\/\//, "https://"));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Remplace les événements d'un agenda par ceux du fichier .ics. */
function applyIcs(cal: ExternalCalendar, text: string) {
  const { events } = parseIcs(text);
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("ce n'est pas un agenda iCal (.ics)");
  const fresh: CalEvent[] = events.map(({ uid: u, ...e }) => ({
    ...e,
    id: `${cal.id}:${u}`,
    color: cal.color,
    personaIds: cal.personaId ? [cal.personaId] : [],
    source: { calId: cal.id, uid: u },
  }));
  useApp.setState((s) => ({
    events: [...s.events.filter((e) => e.source?.calId !== cal.id), ...fresh],
    calendars: s.calendars.map((c) => (c.id === cal.id ? { ...c, count: fresh.length, lastSync: new Date().toISOString(), error: undefined } : c)),
  }));
  return fresh.length;
}

export async function syncCalendar(cal: ExternalCalendar) {
  if (cal.kind !== "url" || !cal.url) return;
  try {
    applyIcs(cal, await fetchText(cal.url));
  } catch (e) {
    useApp.getState().update("calendars", cal.id, { error: (e as Error).message, lastSync: new Date().toISOString() });
  }
}

/** Resynchronise les agendas par lien au démarrage puis toutes les 30 minutes. */
function useBoot() {
  useEffect(() => {
    const run = () => {
      for (const c of useApp.getState().calendars) {
        if (c.kind === "url" && (!c.lastSync || Date.now() - Date.parse(c.lastSync) > RESYNC - 60000)) syncCalendar(c);
      }
    };
    run();
    const t = setInterval(run, RESYNC);
    return () => clearInterval(t);
  }, []);
}

function CalendarRow({ c }: { c: ExternalCalendar }) {
  const update = useApp((s) => s.update);
  const [busy, setBusy] = useState(false);
  const setColor = (color: string) => {
    update("calendars", c.id, { color });
    // Les événements déjà importés prennent la nouvelle couleur.
    useApp.setState((s) => ({ events: s.events.map((e) => (e.source?.calId === c.id ? { ...e, color } : e)) }));
  };
  const setPersona = (personaId?: string) => {
    update("calendars", c.id, { personaId });
    useApp.setState((s) => ({ events: s.events.map((e) => (e.source?.calId === c.id ? { ...e, personaIds: personaId ? [personaId] : [] } : e)) }));
  };
  const remove = () => {
    if (!confirm(`Retirer « ${c.name} » et ses ${c.count} événements ?`)) return;
    useApp.setState((s) => ({ events: s.events.filter((e) => e.source?.calId !== c.id), calendars: s.calendars.filter((x) => x.id !== c.id) }));
  };
  return (
    <div className="grid gap-2 rounded-xl border border-line bg-base/50 p-2.5">
      <div className="flex items-center gap-2">
        <input type="color" value={c.color} onChange={(e) => setColor(e.target.value)} className="h-5 w-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" title="Couleur" />
        <input className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-bright outline-none" value={c.name} onChange={(e) => update("calendars", c.id, { name: e.target.value })} />
        {c.kind === "url" && (
          <button
            className="text-muted hover:text-bright cursor-pointer"
            title="Synchroniser maintenant"
            onClick={async () => {
              setBusy(true);
              await syncCalendar(c);
              setBusy(false);
            }}
          >
            <RefreshCw size={14} className={clsx(busy && "animate-spin")} />
          </button>
        )}
        <button className="text-muted hover:text-bad cursor-pointer" title="Retirer cet agenda" onClick={remove}>
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2 text-[11.5px] text-muted">
        {c.kind === "url" ? <Link2 size={12} /> : <FileUp size={12} />}
        <span>
          {c.count} événement{c.count > 1 ? "s" : ""}
          {c.lastSync && ` · ${c.kind === "url" ? "synchro" : "importé"} ${fmt(new Date(c.lastSync), "d MMM HH:mm")}`}
        </span>
      </div>
      {c.error && <div className="rounded-md bg-bad/10 px-2 py-1 text-[11.5px] text-bad">Échec : {c.error}</div>}
      <PersonaSelect value={c.personaId} onChange={setPersona} placeholder="Pour toute la famille" />
    </div>
  );
}

function Panel() {
  const calendars = useApp((s) => s.calendars);
  const events = useApp((s) => s.events);
  const add = useApp((s) => s.add);
  const file = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [over, setOver] = useState(false);

  const newCal = (name: string, kind: ExternalCalendar["kind"], u?: string): ExternalCalendar => {
    const cal: ExternalCalendar = { id: uid(), name, kind, url: u, color: PALETTE[(calendars.length * 3 + 7) % PALETTE.length], count: 0 };
    add("calendars", cal);
    return cal;
  };

  const importFile = async (f: File) => {
    try {
      const text = await f.text();
      const parsed = parseIcs(text);
      const cal = newCal(parsed.name ?? f.name.replace(/\.ics$/i, ""), "file");
      const n = applyIcs(cal, text);
      setMsg({ ok: true, text: `${n} événements importés depuis « ${cal.name} ».` });
    } catch (e) {
      setMsg({ ok: false, text: `Import impossible : ${(e as Error).message}` });
    }
  };

  const subscribe = async () => {
    const u = url.trim();
    if (!u) return;
    setMsg({ ok: true, text: "Téléchargement de l'agenda…" });
    try {
      const text = await fetchText(u);
      const parsed = parseIcs(text);
      const cal = newCal(parsed.name ?? (u.includes("google") ? "Google Agenda" : u.includes("outlook") || u.includes("office") ? "Outlook" : u.includes("icloud") ? "iCloud" : "Agenda"), "url", u);
      const n = applyIcs(cal, text);
      setUrl("");
      setMsg({ ok: true, text: `Abonné à « ${cal.name} » : ${n} événements, mis à jour toutes les 30 min.` });
    } catch (e) {
      setMsg({
        ok: false,
        text: isTauri()
          ? `Lien inaccessible : ${(e as Error).message}`
          : "Dans l'aperçu navigateur, ces liens sont bloqués : l'abonnement fonctionne dans l'application installée.",
      });
    }
  };

  const exportIcs = async () => {
    const mine = events.filter((e) => !e.source);
    const path = await saveExport(`Nadendar ${fmt(new Date(), "yyyy-MM-dd")}.ics`, new TextEncoder().encode(toIcs(mine)), "text/calendar");
    setMsg({ ok: true, text: path ? `${mine.length} événements exportés : ${path}` : `${mine.length} événements exportés.` });
  };

  return (
    <div className="grid gap-3">
      <div
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) importFile(f);
        }}
        className={clsx("grid gap-2 rounded-xl border border-dashed p-3 transition-colors", over ? "border-brand bg-sel" : "border-line2")}
      >
        <Button icon={FileUp} onClick={() => file.current?.click()}>
          Importer un fichier .ics
        </Button>
        <input ref={file} type="file" accept=".ics,text/calendar" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        <span className="text-center text-[11.5px] text-faint">ou glisser le fichier ici</span>
      </div>

      <div className="grid gap-1.5">
        <span className="text-[12px] font-medium text-muted">S'abonner par lien (reste à jour)</span>
        <div className="flex gap-1.5">
          <input className="field text-[12.5px]" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/…/basic.ics" onKeyDown={(e) => e.key === "Enter" && subscribe()} />
          <Button variant="primary" icon={Link2} onClick={subscribe} disabled={!url.trim()}>
            OK
          </Button>
        </div>
        <details className="text-[11.5px] text-muted">
          <summary className="cursor-pointer text-fg">Où trouver ce lien ?</summary>
          <ul className="mt-1.5 grid gap-1.5 pl-1">
            <li>
              <b className="text-fg">Google Agenda</b> (sur ordinateur) : ⚙ Paramètres ▸ à gauche, l'agenda voulu ▸ « Intégrer l'agenda » ▸ copier l'<i>Adresse secrète au format iCal</i>.
            </li>
            <li>
              <b className="text-fg">Outlook / Microsoft 365</b> : Paramètres ▸ Calendrier ▸ Calendriers partagés ▸ « Publier un calendrier » ▸ copier le lien <i>ICS</i>.
            </li>
            <li>
              <b className="text-fg">Apple iCloud</b> : app Calendrier ▸ (i) à côté de l'agenda ▸ « Calendrier public » ▸ copier le lien (webcal://…).
            </li>
            <li>Ou un export : Google ▸ Paramètres ▸ « Importer et exporter » ▸ Exporter (fichier .ics dans un .zip).</li>
          </ul>
        </details>
      </div>

      {msg && <p className={clsx("rounded-lg px-2.5 py-2 text-[12px]", msg.ok ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad")}>{msg.text}</p>}

      {!calendars.length && <Empty icon={CalendarSync} text="Aucun agenda externe. Importe ton Google Agenda, Outlook ou iCloud." />}
      {calendars.map((c) => (
        <CalendarRow key={c.id} c={c} />
      ))}

      <Button icon={Download} onClick={exportIcs}>
        Exporter mes événements (.ics)
      </Button>
      <p className="text-[11px] text-faint">À réimporter dans Google Agenda, Outlook ou le calendrier du téléphone.</p>
    </div>
  );
}

export const externalPlugin: Plugin = {
  id: "external",
  name: "Agendas externes",
  tagline: "Importer Google Agenda, Outlook, iCloud (.ics ou lien qui se met à jour) et exporter en .ics.",
  icon: CalendarSync,
  color: "#4285f4",
  category: "productivite",
  defaultOn: true,
  links: ["meetings"],
  useBoot,
  panel: { label: "Agendas", component: Panel },
};
