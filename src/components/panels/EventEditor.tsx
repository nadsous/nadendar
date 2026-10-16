import clsx from "clsx";
import { addDays, differenceInMinutes } from "date-fns";
import { Bell, CalendarDays, Copy, Mail, MapPin, Repeat, Stethoscope, Trash2, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { dayKey, isoLocal, parseLocal, uid } from "../../lib/dates";
import type { CalEvent, EventKind, MeetingProvider, Recurrence } from "../../lib/types";
import { isOn, pluginById } from "../../plugins/registry";
import { JoinButton } from "../../plugins/meetings";
import { useApp } from "../../store/store";
import { guessProvider, MEETING } from "../ui/icons";
import { Button, ColorDots, Field, Modal, PersonaPicker, Toggle } from "../ui/ui";

const KINDS: { id: EventKind; label: string; icon: typeof CalendarDays }[] = [
  { id: "event", label: "Événement", icon: CalendarDays },
  { id: "meeting", label: "Réunion", icon: Video },
  { id: "appointment", label: "Rendez-vous", icon: Stethoscope },
  { id: "reminder", label: "Rappel", icon: Bell },
];

const WD = ["L", "M", "M", "J", "V", "S", "D"];

const blank = (): CalEvent => {
  const s = new Date();
  s.setMinutes(0, 0, 0);
  s.setHours(s.getHours() + 1);
  return { id: uid(), title: "", kind: "event", start: isoLocal(s), end: isoLocal(new Date(s.getTime() + 3600000)), allDay: false, personaIds: [] };
};

export function EventEditor() {
  const editing = useApp((s) => s.ui.editingEvent);
  const setUI = useApp((s) => s.setUI);
  const events = useApp((s) => s.events);
  const settings = useApp((s) => s.settings);
  const { add, update, remove } = useApp.getState();
  const [ev, setEv] = useState<CalEvent>(blank);

  useEffect(() => {
    if (editing) setEv({ ...blank(), ...editing, id: editing.id ?? uid() } as CalEvent);
  }, [editing]);

  const close = () => setUI({ editingEvent: null });
  const exists = events.some((e) => e.id === ev.id);
  const meetingsOn = isOn({ settings }, pluginById.get("meetings")!);
  const mailOn = isOn({ settings }, pluginById.get("mail")!);
  const set = (p: Partial<CalEvent>) => setEv((e) => ({ ...e, ...p }));

  const start = parseLocal(ev.start);
  const end = parseLocal(ev.end);
  const setStartDate = (v: string) => {
    if (!v) return;
    const dur = differenceInMinutes(end, start);
    const ns = parseLocal(`${v}T${ev.start.slice(11, 16) || "00:00"}`);
    set({ start: isoLocal(ns), end: isoLocal(new Date(ns.getTime() + dur * 60000)) });
  };
  const setStartTime = (v: string) => {
    if (!v) return;
    const dur = differenceInMinutes(end, start);
    const ns = parseLocal(`${ev.start.slice(0, 10)}T${v}`);
    set({ start: isoLocal(ns), end: isoLocal(new Date(ns.getTime() + dur * 60000)) });
  };

  const save = () => {
    const clean: CalEvent = { ...ev, title: ev.title.trim() };
    if (clean.allDay) {
      clean.start = `${clean.start.slice(0, 10)}T00:00`;
      clean.end = `${(clean.end.slice(0, 10) < clean.start.slice(0, 10) ? clean.start : clean.end).slice(0, 10)}T00:00`;
    } else if (parseLocal(clean.end) <= parseLocal(clean.start)) {
      clean.end = isoLocal(new Date(parseLocal(clean.start).getTime() + 30 * 60000));
    }
    if (exists) update("events", clean.id, clean);
    else add("events", clean);
    close();
  };

  const rec = ev.recurrence;
  const setRec = (p: Partial<Recurrence> | null) =>
    set({ recurrence: p === null ? undefined : ({ freq: "weekly", interval: 1, ...rec, ...p } as Recurrence) });

  const occurrenceDay = editing && "start" in editing && editing.start ? editing.start.slice(0, 10) : dayKey(start);

  return (
    <Modal
      open={!!editing}
      onClose={close}
      title={exists ? "Modifier" : "Nouvel élément"}
      icon={KINDS.find((k) => k.id === ev.kind)?.icon ?? CalendarDays}
      width={620}
      footer={
        <>
          {exists && (
            <>
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => {
                  remove("events", ev.id);
                  close();
                }}
              >
                {rec ? "Toute la série" : "Supprimer"}
              </Button>
              {rec && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    update("events", ev.id, { recurrence: { ...rec, exdates: [...(rec.exdates ?? []), occurrenceDay] } });
                    close();
                  }}
                >
                  Cette occurrence
                </Button>
              )}
              <Button
                variant="ghost"
                icon={Copy}
                onClick={() => {
                  const s = addDays(start, 7);
                  add("events", { ...ev, id: uid(), start: isoLocal(s), end: isoLocal(addDays(end, 7)) });
                  close();
                }}
                title="Dupliquer la semaine suivante"
              />
            </>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={close}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <input
          autoFocus
          className="w-full bg-transparent text-[20px] font-semibold text-bright outline-none placeholder:text-faint"
          placeholder="Titre"
          value={ev.title}
          onChange={(e) => set({ title: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <div className="grid grid-cols-4 gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => set({ kind: k.id, meeting: k.id === "meeting" || k.id === "appointment" ? ev.meeting ?? { provider: k.id === "appointment" ? "doctolib" : "meet" } : ev.meeting })}
              className={clsx("flex flex-col items-center justify-center gap-0.5 rounded-lg border py-1.5 text-[10.5px] transition-colors cursor-pointer sm:flex-row sm:gap-1.5 sm:py-2 sm:text-[12.5px]", ev.kind === k.id ? "border-brand/60 bg-sel text-bright" : "border-line text-muted hover:text-fg")}
            >
              <k.icon size={14} /> <span>{k.label}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 rounded-xl border border-line bg-base/40 p-3">
          <div className="flex items-center gap-3">
            <Toggle on={ev.allDay} onChange={(v) => set({ allDay: v })} />
            <span className="text-[13px]">Toute la journée</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Field label="Début">
              <input type="date" className="field" value={ev.start.slice(0, 10)} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            {!ev.allDay && (
              <Field label="Heure">
                <input type="time" className="field" value={ev.start.slice(11, 16)} onChange={(e) => setStartTime(e.target.value)} />
              </Field>
            )}
            <Field label="Fin">
              <input type="date" className="field" value={ev.end.slice(0, 10)} onChange={(e) => e.target.value && set({ end: `${e.target.value}T${ev.end.slice(11, 16) || "00:00"}` })} />
            </Field>
            {!ev.allDay && (
              <Field label="Heure">
                <input type="time" className="field" value={ev.end.slice(11, 16)} onChange={(e) => e.target.value && set({ end: `${ev.end.slice(0, 10)}T${e.target.value}` })} />
              </Field>
            )}
          </div>
          {/* Récurrence */}
          <div className="flex flex-wrap items-center gap-2">
            <Repeat size={14} className="text-muted" />
            <select
              className="field !w-auto"
              value={rec?.freq ?? ""}
              onChange={(e) => setRec(e.target.value ? { freq: e.target.value as Recurrence["freq"], byWeekday: e.target.value === "weekly" ? [((start.getDay() + 6) % 7) + 1] : undefined } : null)}
            >
              <option value="">Ne se répète pas</option>
              <option value="daily">Tous les jours</option>
              <option value="weekly">Toutes les semaines</option>
              <option value="monthly">Tous les mois</option>
              <option value="yearly">Tous les ans</option>
            </select>
            {rec && (
              <>
                <span className="text-[12px] text-muted">tous les</span>
                <input type="number" min={1} className="field !w-16" value={rec.interval} onChange={(e) => setRec({ interval: Math.max(1, +e.target.value) })} />
                {rec.freq === "weekly" && (
                  <div className="flex gap-1">
                    {WD.map((l, i) => {
                      const on = rec.byWeekday?.includes(i + 1);
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            const cur = rec.byWeekday ?? [];
                            const next = on ? cur.filter((x) => x !== i + 1) : [...cur, i + 1];
                            setRec({ byWeekday: next.length ? next.sort() : cur });
                          }}
                          className={clsx("h-7 w-7 rounded-md text-[12px] font-medium cursor-pointer", on ? "bg-brand text-on-brand" : "bg-elev text-muted")}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                )}
                <span className="text-[12px] text-muted">jusqu'au</span>
                <input type="date" className="field !w-auto" value={rec.until ?? ""} onChange={(e) => setRec({ until: e.target.value || undefined })} />
              </>
            )}
          </div>
        </div>

        {meetingsOn && (ev.kind === "meeting" || ev.kind === "appointment" || ev.meeting) && (
          <div className="grid gap-2.5 rounded-xl border border-line bg-base/40 p-3">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
              {(Object.keys(MEETING) as MeetingProvider[]).map((k) => {
                const m = MEETING[k];
                const on = ev.meeting?.provider === k;
                return (
                  <button
                    key={k}
                    title={m.label}
                    onClick={() => set({ meeting: { ...ev.meeting, provider: k } })}
                    className={clsx("flex flex-col items-center gap-1 rounded-lg border py-1.5 text-[10px] cursor-pointer", on ? "text-bright" : "border-line text-muted")}
                    style={on ? { borderColor: m.color, background: m.color + "1f" } : undefined}
                  >
                    <m.icon size={15} color={m.color} />
                    <span className="truncate max-w-full px-0.5">{m.label.replace("Microsoft ", "").replace("Google ", "")}</span>
                  </button>
                );
              })}
            </div>
            {ev.meeting && ev.meeting.provider !== "presentiel" && (
              <div className="flex items-end gap-2">
                <Field label={ev.meeting.provider === "telephone" ? "Numéro" : "Lien"} className="flex-1">
                  <input
                    className="field"
                    placeholder={MEETING[ev.meeting.provider].hint}
                    value={(ev.meeting.provider === "telephone" ? ev.meeting.phone : ev.meeting.url) ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (ev.meeting!.provider === "telephone") set({ meeting: { ...ev.meeting!, phone: v } });
                      else set({ meeting: { ...ev.meeting!, url: v, provider: guessProvider(v) ?? ev.meeting!.provider } });
                    }}
                  />
                </Field>
                <JoinButton {...ev.meeting} />
              </div>
            )}
          </div>
        )}

        <Field label="Participants">
          <PersonaPicker value={ev.personaIds} onChange={(personaIds) => set({ personaIds })} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Lieu">
            <div className="relative">
              <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input className="field !pl-8" value={ev.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder="Adresse, salle…" />
            </div>
          </Field>
          <Field label="Rappel">
            <select className="field" value={ev.reminderMin ?? ""} onChange={(e) => set({ reminderMin: e.target.value === "" ? undefined : +e.target.value })}>
              <option value="">Aucun</option>
              <option value="0">À l'heure</option>
              <option value="5">5 min avant</option>
              <option value="10">10 min avant</option>
              <option value="30">30 min avant</option>
              <option value="60">1 h avant</option>
              <option value="1440">La veille</option>
            </select>
          </Field>
        </div>

        {mailOn && (
          <details className="rounded-xl border border-line bg-base/40 p-3" open={!!ev.mail}>
            <summary className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
              <Mail size={14} /> Mail lié
            </summary>
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="Objet">
                <input className="field" value={ev.mail?.subject ?? ""} onChange={(e) => set({ mail: { ...ev.mail, subject: e.target.value } })} />
              </Field>
              <Field label="De">
                <input className="field" value={ev.mail?.from ?? ""} onChange={(e) => set({ mail: { subject: "", ...ev.mail, from: e.target.value } })} />
              </Field>
              <Field label="Lien vers le mail (Gmail, Outlook…)" className="sm:col-span-2">
                <input className="field" value={ev.mail?.url ?? ""} placeholder="https://mail.google.com/mail/u/0/#inbox/…" onChange={(e) => set({ mail: { subject: "", ...ev.mail, url: e.target.value } })} />
              </Field>
            </div>
          </details>
        )}

        <Field label="Couleur">
          <ColorDots value={ev.color ?? "#fe7146"} onChange={(color) => set({ color })} />
        </Field>
        <Field label="Notes">
          <textarea className="field" rows={3} value={ev.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
