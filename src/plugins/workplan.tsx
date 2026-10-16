import clsx from "clsx";
import { addDays, endOfMonth, isSameDay, isWeekend, startOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { CalendarRange, Factory, Minus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { cap, dayKey, fmt, fromKey } from "../lib/dates";
import { holidayOn } from "../lib/holidays";
import type { Leave, LeaveType, Persona, WorkPattern } from "../lib/types";
import {
  LEAVE_TYPES,
  PRESETS,
  SHIFT_TYPES,
  shiftByCode,
  shiftHours,
  shiftInterval,
  workOn,
  type DayWork,
} from "../lib/work";
import { useApp } from "../store/store";
import { Avatar } from "../components/ui/Avatar";
import { LEAVE_ICONS, SHIFT_ICONS } from "../components/ui/icons";
import { Button, Empty, Field, Modal, Toggle } from "../components/ui/ui";
import type { CalItem, PersonaChip, Plugin } from "./types";

export function workIcon(w: DayWork) {
  if (w.leave) return { icon: LEAVE_ICONS[w.leave.type], color: LEAVE_TYPES[w.leave.type].color, label: LEAVE_TYPES[w.leave.type].label };
  if (w.shift) {
    const label = w.holiday ? `Férié — ${w.holiday}` : `${w.shift.label}${w.shift.off ? "" : ` ${w.shift.start}–${w.shift.end}`}`;
    return { icon: SHIFT_ICONS[w.shift.icon], color: w.shift.color, label };
  }
  return null;
}

/** Heures travaillées d'une personne sur une période. */
export function workedHours(personaId: string, from: Date, to: Date, patterns: WorkPattern[], leaves: Leave[]) {
  let h = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = workOn(personaId, d, patterns, leaves);
    if (w?.shift && !w.leave) h += shiftHours(w.shift);
  }
  return h;
}

// ── Vue Planning : personas × jours du mois ─────────────────────────────────

function PlanningView() {
  const cursor = useApp((s) => s.ui.cursor);
  const personas = useApp((s) => s.personas);
  const patterns = useApp((s) => s.patterns);
  const leaves = useApp((s) => s.leaves);
  const setUI = useApp((s) => s.setUI);
  const [sel, setSel] = useState<{ pid: string; a: number; b: number } | null>(null);
  const [leaveDraft, setLeaveDraft] = useState<Omit<Leave, "id"> | null>(null);
  const add = useApp((s) => s.add);

  const anchor = new Date(cursor);
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let d = startOfMonth(anchor); d <= endOfMonth(anchor); d = addDays(d, 1)) out.push(d);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.getFullYear(), anchor.getMonth()]);

  const workers = personas.filter((p) => patterns.some((x) => x.personaId === p.id) || leaves.some((l) => l.personaId === p.id));
  const today = new Date();

  if (!workers.length)
    return (
      <Empty icon={Factory} text="Aucun planning de travail. Ouvre un persona et choisis un rythme (bureau, 3×8, 12 h…).">
        <Button variant="primary" onClick={() => personas[0] && setUI({ editingPersona: personas[0] })} disabled={!personas.length}>
          Configurer un persona
        </Button>
      </Empty>
    );

  const finishSel = () => {
    if (!sel) return;
    const a = Math.min(sel.a, sel.b);
    const b = Math.max(sel.a, sel.b);
    setLeaveDraft({ personaId: sel.pid, type: "CP", start: dayKey(days[a]), end: dayKey(days[b]) });
    setSel(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden" onMouseUp={finishSel} onMouseLeave={() => setSel(null)}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[12px] text-muted">
        <span className="font-medium text-fg">Glisser sur une ligne pour poser des congés.</span>
        <div className="ml-auto hidden md:flex flex-wrap items-center gap-3">
          {SHIFT_TYPES.filter((s) => !s.code.endsWith("12")).map((s) => {
            const I = SHIFT_ICONS[s.icon];
            return (
              <span key={s.code} className="flex items-center gap-1">
                <I size={13} color={s.color} /> {s.label}
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-[12px]">
          <thead className="sticky top-0 z-10 bg-panel">
            <tr>
              <th className="sticky left-0 z-20 bg-panel px-3 py-2 text-left font-medium text-muted min-w-[170px]">Persona</th>
              {days.map((d) => {
                const hol = holidayOn(d);
                return (
                  <th
                    key={d.getTime()}
                    title={hol}
                    className={clsx(
                      "w-[34px] min-w-[34px] py-1.5 text-center font-normal",
                      isWeekend(d) ? "text-faint" : "text-muted",
                      hol && "text-rose-300",
                    )}
                  >
                    <div className="text-[10px] uppercase">{fmt(d, "EEEEE")}</div>
                    <div
                      className={clsx(
                        "mx-auto mt-0.5 grid h-6 w-6 place-items-center rounded-md tabular",
                        isSameDay(d, today) ? "bg-brand text-on-brand font-semibold" : "text-fg",
                      )}
                    >
                      {d.getDate()}
                    </div>
                  </th>
                );
              })}
              <th className="px-3 text-right font-medium text-muted">Heures</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((p, row) => {
              const hours = workedHours(p.id, days[0], days[days.length - 1], patterns, leaves);
              return (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: row * 0.04 }}
                >
                  <td className="sticky left-0 z-10 border-t border-line bg-panel px-3 py-1.5">
                    <button className="flex items-center gap-2 cursor-pointer" onClick={() => setUI({ editingPersona: p })}>
                      <Avatar persona={p} size={26} />
                      <span className="text-left">
                        <span className="block text-[13px] text-bright">{p.name}</span>
                        <span className="block text-[11px] text-faint">{patterns.find((x) => x.personaId === p.id)?.name ?? "—"}</span>
                      </span>
                    </button>
                  </td>
                  {days.map((d, i) => {
                    const w = workOn(p.id, d, patterns, leaves);
                    const info = w && workIcon(w);
                    const inSel = sel && sel.pid === p.id && i >= Math.min(sel.a, sel.b) && i <= Math.max(sel.a, sel.b);
                    const I = info?.icon;
                    return (
                      <td
                        key={i}
                        title={info ? `${fmt(d, "EEE d MMM")} — ${info.label}` : undefined}
                        onMouseDown={() => setSel({ pid: p.id, a: i, b: i })}
                        onMouseEnter={() => sel && sel.pid === p.id && setSel({ ...sel, b: i })}
                        className={clsx("border-t border-line p-[3px] cursor-cell", isWeekend(d) && "bg-white/[0.015]")}
                      >
                        <div
                          className={clsx(
                            "grid h-7 w-7 place-items-center rounded-md transition-transform",
                            inSel && "ring-2 ring-brand scale-105",
                            w?.shift?.off && !w.leave && "opacity-35",
                          )}
                          style={info ? { background: info.color + (w?.leave ? "33" : "22") } : undefined}
                        >
                          {I && <I size={14} color={info!.color} strokeWidth={2.1} />}
                        </div>
                      </td>
                    );
                  })}
                  <td className="border-t border-line px-3 text-right tabular text-fg">{Math.round(hours)} h</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <LeaveModal
        draft={leaveDraft}
        onClose={() => setLeaveDraft(null)}
        onSave={(l) => {
          add("leaves", l);
          setLeaveDraft(null);
        }}
      />
    </div>
  );
}

function LeaveModal({ draft, onClose, onSave }: { draft: Omit<Leave, "id"> | null; onClose: () => void; onSave: (l: Omit<Leave, "id">) => void }) {
  const [d, setD] = useState(draft);
  const personas = useApp((s) => s.personas);
  if (draft && (!d || d.start !== draft.start || d.personaId !== draft.personaId || d.end !== draft.end)) setD(draft);
  const p = personas.find((x) => x.id === d?.personaId);
  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={`Absence${p ? ` — ${p.name}` : ""}`}
      icon={CalendarRange}
      width={440}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={() => d && onSave(d)}>
            Poser
          </Button>
        </>
      }
    >
      {d && (
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(LEAVE_TYPES) as LeaveType[]).map((t) => {
              const I = LEAVE_ICONS[t];
              const on = d.type === t;
              return (
                <button
                  key={t}
                  onClick={() => setD({ ...d, type: t })}
                  className={clsx("flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[12px] transition-all cursor-pointer", on ? "text-bright" : "border-line text-muted")}
                  style={on ? { borderColor: LEAVE_TYPES[t].color, background: LEAVE_TYPES[t].color + "1f" } : undefined}
                >
                  <I size={18} color={LEAVE_TYPES[t].color} />
                  {LEAVE_TYPES[t].label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Du">
              <input type="date" className="field" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} />
            </Field>
            <Field label="Au (inclus)">
              <input type="date" className="field" value={d.end} onChange={(e) => setD({ ...d, end: e.target.value })} />
            </Field>
          </div>
          <Field label="Note">
            <input className="field" value={d.note ?? ""} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="Vacances, enfant malade…" />
          </Field>
        </div>
      )}
    </Modal>
  );
}

// ── Section de la fiche persona ─────────────────────────────────────────────

function PersonaSection({ persona }: { persona: Persona; onChange: (p: Partial<Persona>) => void }) {
  const patterns = useApp((s) => s.patterns);
  const leaves = useApp((s) => s.leaves);
  const { add, update, remove } = useApp.getState();
  const [draft, setDraft] = useState<Omit<Leave, "id"> | null>(null);
  const pattern = patterns.find((p) => p.personaId === persona.id);
  const myLeaves = leaves.filter((l) => l.personaId === persona.id).sort((a, b) => a.start.localeCompare(b.start));

  const setPattern = (patch: Partial<WorkPattern>) => {
    if (pattern) update("patterns", pattern.id, patch);
  };

  const applyPreset = (id: string) => {
    const pr = PRESETS.find((x) => x.id === id);
    if (!pr) return;
    // Ancrage au lundi de la semaine en cours.
    const now = new Date();
    const monday = addDays(now, -((now.getDay() + 6) % 7));
    if (pattern) setPattern({ name: pr.name, cycle: [...pr.cycle] });
    else
      add("patterns", {
        personaId: persona.id,
        name: pr.name,
        anchor: dayKey(monday),
        cycle: [...pr.cycle],
        skipHolidays: true,
        from: dayKey(addDays(monday, -365)),
      });
  };

  const codes = SHIFT_TYPES.map((s) => s.code);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {PRESETS.map((pr) => (
          <button
            key={pr.id}
            onClick={() => applyPreset(pr.id)}
            className={clsx(
              "rounded-xl border px-2.5 py-2 text-left transition-colors cursor-pointer",
              pattern?.name === pr.name ? "border-brand/60 bg-sel" : "border-line hover:bg-elev",
            )}
          >
            <div className="text-[12.5px] font-medium text-bright">{pr.name}</div>
            <div className="text-[11px] text-faint leading-tight">{pr.hint}</div>
          </button>
        ))}
      </div>

      {pattern && (
        <div className="grid gap-3 rounded-xl border border-line bg-base/50 p-3">
          <div className="text-[12px] text-muted">
            Rythme de <b className="text-fg">{pattern.cycle.length} jours</b> — cliquer sur un jour pour changer le poste.
          </div>
          <div className="flex flex-wrap gap-1">
            {pattern.cycle.map((c, i) => {
              const s = shiftByCode.get(c)!;
              const I = SHIFT_ICONS[s.icon];
              return (
                <button
                  key={i}
                  title={s.label}
                  onClick={() => {
                    const next = [...pattern.cycle];
                    next[i] = codes[(codes.indexOf(c) + 1) % codes.length];
                    setPattern({ cycle: next });
                  }}
                  className="flex w-10 flex-col items-center gap-0.5 rounded-lg border border-line py-1 cursor-pointer hover:border-line2"
                  style={{ background: s.color + "1a" }}
                >
                  <span className="text-[9.5px] text-faint">J{i + 1}</span>
                  <I size={15} color={s.color} />
                  <span className="text-[10px] font-medium" style={{ color: s.color }}>
                    {s.code}
                  </span>
                </button>
              );
            })}
            <div className="flex flex-col gap-1">
              <button className="grid h-[22px] w-7 place-items-center rounded-md bg-elev text-muted hover:text-bright cursor-pointer" onClick={() => setPattern({ cycle: [...pattern.cycle, "R"] })} title="Ajouter un jour">
                <Plus size={13} />
              </button>
              <button
                className="grid h-[22px] w-7 place-items-center rounded-md bg-elev text-muted hover:text-bright cursor-pointer"
                onClick={() => pattern.cycle.length > 1 && setPattern({ cycle: pattern.cycle.slice(0, -1) })}
                title="Retirer un jour"
              >
                <Minus size={13} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Le jour 1 tombe le" hint={cap(fmt(fromKey(pattern.anchor), "EEEE d MMMM"))}>
              <input type="date" className="field" value={pattern.anchor} onChange={(e) => e.target.value && setPattern({ anchor: e.target.value })} />
            </Field>
            <Field label="Fin du rythme (optionnel)">
              <input type="date" className="field" value={pattern.to ?? ""} onChange={(e) => setPattern({ to: e.target.value || undefined })} />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Toggle on={pattern.skipHolidays} onChange={(v) => setPattern({ skipHolidays: v })} />
            <span className="text-[12.5px]">Repos les jours fériés</span>
            <span className="flex-1" />
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => remove("patterns", pattern.id)}>
              Retirer le rythme
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted">Congés & absences</span>
        <Button
          size="sm"
          icon={Plus}
          onClick={() => {
            const k = dayKey(new Date());
            setDraft({ personaId: persona.id, type: "CP", start: k, end: k });
          }}
        >
          Poser
        </Button>
      </div>
      {myLeaves.length > 0 && (
        <div className="grid gap-1">
          {myLeaves.map((l) => {
            const I = LEAVE_ICONS[l.type];
            const past = l.end < dayKey(new Date());
            return (
              <div key={l.id} className={clsx("flex items-center gap-2 rounded-lg bg-base/60 px-2.5 py-1.5 text-[12.5px]", past && "opacity-50")}>
                <I size={14} color={LEAVE_TYPES[l.type].color} />
                <span className="text-bright">{LEAVE_TYPES[l.type].label}</span>
                <span className="text-muted">
                  {fmt(fromKey(l.start), "d MMM")} → {fmt(fromKey(l.end), "d MMM yyyy")}
                </span>
                <span className="flex-1 truncate text-faint">{l.note}</span>
                <button className="text-faint hover:text-bad cursor-pointer" onClick={() => remove("leaves", l.id)} aria-label="Supprimer">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <LeaveModal
        draft={draft}
        onClose={() => setDraft(null)}
        onSave={(l) => {
          add("leaves", l);
          setDraft(null);
        }}
      />
    </div>
  );
}

function DayDetail({ day }: { day: Date }) {
  const personas = useApp((s) => s.personas);
  const patterns = useApp((s) => s.patterns);
  const leaves = useApp((s) => s.leaves);
  const rows = personas
    .map((p) => ({ p, w: workOn(p.id, day, patterns, leaves) }))
    .filter((x): x is { p: Persona; w: DayWork } => !!x.w);
  if (!rows.length) return null;
  return (
    <div className="grid gap-1">
      {rows.map(({ p, w }) => {
        const info = workIcon(w)!;
        const I = info.icon;
        return (
          <div key={p.id} className="flex items-center gap-2 rounded-lg bg-base/60 px-2 py-1.5">
            <Avatar persona={p} size={22} />
            <span className="flex-1 text-[12.5px] text-bright">{p.name}</span>
            <span className="flex items-center gap-1 text-[12px]" style={{ color: info.color }}>
              <I size={14} /> {info.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const workplanPlugin: Plugin = {
  id: "workplan",
  name: "Planning de travail",
  tagline: "Rythmes répétés (bureau, 2×8, 3×8 usine, 12 h…), congés payés, RTT, arrêts.",
  icon: Factory,
  color: "#fb923c",
  category: "travail",
  defaultOn: true,
  links: ["deliveries", "budget", "holidays", "astro"],
  chips: (day, s) => {
    const out: PersonaChip[] = [];
    for (const p of s.personas) {
      if (p.hidden) continue;
      const w = workOn(p.id, day, s.patterns, s.leaves);
      if (!w) continue;
      if (w.shift?.off && !w.holiday && !w.leave) continue;
      const info = workIcon(w)!;
      out.push({ id: `w-${p.id}`, personaId: p.id, icon: info.icon, label: info.label, color: info.color, order: 0 });
    }
    return out;
  },
  items: (from, to, s) => {
    const out: CalItem[] = [];
    for (const p of s.personas) {
      if (p.hidden) continue;
      // La veille aussi : une nuit commencée la veille déborde sur ce jour.
      for (let d = addDays(from, -1); d < to; d = addDays(d, 1)) {
        const w = workOn(p.id, d, s.patterns, s.leaves);
        if (!w || w.leave || !w.shift) continue;
        const iv = shiftInterval(d, w.shift);
        if (!iv || iv[1] <= from || iv[0] >= to) continue;
        out.push({
          id: `shift-${p.id}-${dayKey(d)}`,
          title: `${p.name} · ${w.shift.label}`,
          start: iv[0],
          end: iv[1],
          allDay: false,
          color: w.shift.color,
          personaIds: [p.id],
          icon: SHIFT_ICONS[w.shift.icon],
          source: "workplan",
          subtle: true,
        });
      }
    }
    // Un bloc « journée entière » par absence visible.
    const a = dayKey(from);
    const b = dayKey(addDays(to, -1));
    for (const l of s.leaves) {
      const p = s.personas.find((x) => x.id === l.personaId);
      if (!p || p.hidden || l.end < a || l.start > b) continue;
      out.push({
        id: `leave-${l.id}`,
        title: `${p.name} · ${LEAVE_TYPES[l.type].label}`,
        start: fromKey(l.start < a ? a : l.start),
        end: fromKey(l.end > b ? b : l.end),
        allDay: true,
        color: LEAVE_TYPES[l.type].color,
        personaIds: [p.id],
        icon: LEAVE_ICONS[l.type],
        source: "workplan",
        subtle: true,
      });
    }
    return out;
  },
  view: { id: "planning", label: "Planning", icon: Factory, component: PlanningView },
  personaSection: PersonaSection,
  dayDetail: DayDetail,
};
