import { CheckSquare, ExternalLink, Mail, Upload } from "lucide-react";
import { useState } from "react";
import { cap, dayKey, fmt, isoLocal, parseLocal, uid } from "../lib/dates";
import { openExternal } from "../lib/platform";
import type { MailLink } from "../lib/types";
import { useApp } from "../store/store";
import { guessProvider } from "../components/ui/icons";
import { Button, Empty } from "../components/ui/ui";
import type { Plugin } from "./types";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Lit les en-têtes utiles d'un .eml ou d'un mail collé. */
export function parseMail(raw: string): MailLink & { body: string } {
  const [head, ...rest] = raw.replace(/\r/g, "").split(/\n\n/);
  const h = (name: string) => head.match(new RegExp(`^${name}:\\s*(.+(?:\\n[ \\t].+)*)`, "im"))?.[1]?.replace(/\n[ \t]+/g, " ").trim();
  const subject = decodeWords(h("Subject") ?? h("Objet") ?? "");
  const body = rest.join("\n\n") || (subject ? "" : raw);
  return {
    subject: subject || raw.split("\n").find((l) => l.trim())?.slice(0, 80) || "Mail",
    from: decodeWords(h("From") ?? h("De") ?? ""),
    date: h("Date"),
    body,
    snippet: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240),
  };
}

function decodeWords(s: string) {
  // =?UTF-8?B?...?= et =?UTF-8?Q?...?=
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, _cs, enc: string, txt: string) => {
    try {
      const bytes =
        enc.toUpperCase() === "B"
          ? Uint8Array.from(atob(txt), (c) => c.charCodeAt(0))
          : Uint8Array.from(
              txt.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_m, x: string) => String.fromCharCode(parseInt(x, 16))),
              (c) => c.charCodeAt(0),
            );
      return new TextDecoder().decode(bytes);
    } catch {
      return txt;
    }
  });
}

/** Cherche une date et une heure en français dans le texte (« le 12 novembre à 14h30 », « 12/11 »). */
export function detectWhen(text: string): Date | null {
  const t = text.toLowerCase();
  const now = new Date();
  let d: Date | null = null;
  const m1 = t.match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s+(\d{4}))?/);
  const m2 = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m1) {
    const mi = MONTHS.findIndex((m) => m.normalize("NFD").replace(/\p{M}/gu, "") === m1[2].normalize("NFD").replace(/\p{M}/gu, ""));
    d = new Date(m1[3] ? +m1[3] : now.getFullYear(), mi, +m1[1]);
  } else if (m2) {
    const y = m2[3] ? (m2[3].length === 2 ? 2000 + +m2[3] : +m2[3]) : now.getFullYear();
    d = new Date(y, +m2[2] - 1, +m2[1]);
  }
  if (!d || isNaN(d.getTime())) return null;
  if (!m1?.[3] && !m2?.[3] && d < now) d.setFullYear(d.getFullYear() + 1);
  const hm = t.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})?\b/);
  d.setHours(hm ? +hm[1] : 9, hm?.[2] ? +hm[2] : 0, 0, 0);
  return d;
}

function Panel() {
  const events = useApp((s) => s.events);
  const setUI = useApp((s) => s.setUI);
  const add = useApp((s) => s.add);
  const [text, setText] = useState("");
  const [over, setOver] = useState(false);
  const linked = events.filter((e) => e.mail).sort((a, b) => b.start.localeCompare(a.start));

  const toEvent = (raw: string) => {
    const m = parseMail(raw);
    const when = detectWhen(`${m.subject}\n${m.body}`) ?? new Date(Math.ceil(Date.now() / 3600000) * 3600000);
    const url = m.body.match(/https?:\/\/[^\s"'<>]+/g)?.find((u) => guessProvider(u));
    const provider = url ? guessProvider(url) : null;
    setUI({
      editingEvent: {
        title: m.subject,
        kind: provider ? "meeting" : "event",
        start: isoLocal(when),
        end: isoLocal(new Date(when.getTime() + 3600000)),
        allDay: false,
        personaIds: [],
        mail: { subject: m.subject, from: m.from, date: m.date, snippet: m.snippet },
        meeting: provider ? { provider, url } : undefined,
        notes: m.snippet,
      },
    });
    setText("");
  };

  const toTodo = (raw: string) => {
    const m = parseMail(raw);
    const when = detectWhen(`${m.subject}\n${m.body}`);
    add("todos", { id: uid(), title: `📧 ${m.subject}`, done: false, priority: 1, createdAt: new Date().toISOString(), due: when ? dayKey(when) : undefined });
    setText("");
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setText(await f.text());
    else setText(e.dataTransfer.getData("text/plain"));
  };

  return (
    <div className="grid gap-2.5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border border-dashed p-2.5 transition-colors ${over ? "border-brand bg-sel" : "border-line2"}`}
      >
        <div className="mb-1.5 flex items-center gap-1.5 text-[12px] text-muted">
          <Upload size={13} /> Glisser un fichier .eml ou coller le mail
        </div>
        <textarea
          className="field min-h-[86px] text-[12.5px]"
          value={text}
          placeholder={"Objet : Rendez-vous le 12 novembre à 14h30\nhttps://meet.google.com/abc-defg-hij"}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" variant="primary" icon={Mail} disabled={!text.trim()} onClick={() => toEvent(text)}>
            Créer l'événement
          </Button>
          <Button size="sm" icon={CheckSquare} disabled={!text.trim()} onClick={() => toTodo(text)}>
            En tâche
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-faint">La date, l'heure et le lien de visio sont détectés automatiquement.</p>
      </div>
      {!linked.length && <Empty icon={Mail} text="Aucun mail lié pour l'instant." />}
      {linked.map((e) => (
        <button key={e.id} onClick={() => setUI({ editingEvent: e })} className="rounded-xl border border-line bg-base/50 p-2.5 text-left hover:border-line2 cursor-pointer">
          <div className="flex items-center gap-1.5">
            <Mail size={13} className="text-brand shrink-0" />
            <span className="truncate text-[13px] text-bright">{e.mail!.subject}</span>
            {e.mail!.url && (
              <span
                role="link"
                className="ml-auto text-muted hover:text-bright"
                onClick={(ev) => {
                  ev.stopPropagation();
                  openExternal(e.mail!.url!);
                }}
              >
                <ExternalLink size={13} />
              </span>
            )}
          </div>
          {e.mail!.from && <div className="truncate text-[11.5px] text-muted">{e.mail!.from}</div>}
          <div className="text-[11.5px] text-faint">→ {cap(fmt(parseLocal(e.start), "EEE d MMM, HH:mm"))}</div>
        </button>
      ))}
    </div>
  );
}

export const mailPlugin: Plugin = {
  id: "mail",
  name: "Mails liés",
  tagline: "Glisser un mail : la date, l'heure et le lien visio deviennent un événement.",
  icon: Mail,
  color: "#60a5fa",
  category: "productivite",
  defaultOn: true,
  links: ["meetings", "todo"],
  panel: { label: "Mails", component: Panel },
};
