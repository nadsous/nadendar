import { differenceInCalendarDays } from "date-fns";
import { Droplet, Flower2, Plus, Sparkles } from "lucide-react";
import { averageCycle, CYCLE_PHASES, cycleDay, nextPeriod } from "../lib/cycle";
import { dayKey, fmt } from "../lib/dates";
import type { CycleSettings, Persona } from "../lib/types";
import { useApp } from "../store/store";
import { Avatar } from "../components/ui/Avatar";
import { Button, Field, Toggle } from "../components/ui/ui";
import type { PersonaChip, Plugin } from "./types";

const fresh = (): CycleSettings => ({
  enabled: true,
  lastStart: dayKey(new Date()),
  cycleLength: 28,
  periodLength: 5,
  logs: [],
  discreet: false,
});

function PersonaSection({ persona, onChange }: { persona: Persona; onChange: (p: Partial<Persona>) => void }) {
  const c = persona.cycle;
  if (!c?.enabled)
    return (
      <div className="flex items-center gap-3">
        <Toggle on={false} onChange={() => onChange({ cycle: { ...fresh(), ...c, enabled: true } })} />
        <span className="text-[12.5px] text-muted">Suivre le cycle menstruel (données gardées sur cet appareil)</span>
      </div>
    );
  const set = (p: Partial<CycleSettings>) => onChange({ cycle: { ...c, ...p } });
  const avg = averageCycle(c);
  const next = nextPeriod(c);
  const inDays = differenceInCalendarDays(next, new Date());
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <Toggle on onChange={() => set({ enabled: false })} />
        <span className="text-[12.5px]">Cycle menstruel</span>
        <span className="flex-1" />
        <Toggle on={c.discreet} onChange={(v) => set({ discreet: v })} />
        <span className="text-[12.5px] text-muted">Mode discret</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Début des dernières règles">
          <input type="date" className="field" value={c.lastStart} onChange={(e) => e.target.value && set({ lastStart: e.target.value })} />
        </Field>
        <Field label="Durée du cycle" hint={c.logs.length ? `Moyenne observée : ${avg} j` : undefined}>
          <input type="number" min={18} max={45} className="field" value={c.cycleLength} onChange={(e) => set({ cycleLength: +e.target.value || 28 })} />
        </Field>
        <Field label="Durée des règles">
          <input type="number" min={1} max={10} className="field" value={c.periodLength} onChange={(e) => set({ periodLength: +e.target.value || 5 })} />
        </Field>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">
        <Droplet size={14} className="text-rose-400" />
        Prochaines règles estimées le <b>{fmt(next, "EEEE d MMMM")}</b> ({inDays <= 0 ? "aujourd'hui" : `dans ${inDays} j`})
        <span className="flex-1" />
        <Button
          size="sm"
          icon={Plus}
          onClick={() => {
            const k = dayKey(new Date());
            set({ logs: [...new Set([...c.logs, c.lastStart])], lastStart: k });
          }}
        >
          Règles aujourd'hui
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 text-[11.5px] text-muted">
        {Object.values(CYCLE_PHASES).map((p) => (
          <span key={p.label} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} /> {p.label}
          </span>
        ))}
      </div>
      <p className="text-[11.5px] text-faint">Estimations indicatives, ce n'est pas une méthode de contraception.</p>
    </div>
  );
}

function DayDetail({ day }: { day: Date }) {
  const personas = useApp((s) => s.personas);
  const rows = personas.filter((p) => p.cycle?.enabled && !p.cycle.discreet);
  const out = rows
    .map((p) => ({ p, c: cycleDay(p.cycle!, day) }))
    .filter((x) => x.c);
  if (!out.length) return null;
  return (
    <div className="grid gap-1">
      {out.map(({ p, c }) => (
        <div key={p.id} className="flex items-center gap-2 rounded-lg bg-base/60 px-2 py-1.5 text-[12.5px]">
          <Avatar persona={p} size={22} />
          <span className="flex-1 text-bright">{p.name}</span>
          <span style={{ color: CYCLE_PHASES[c!.phase].color }}>
            {CYCLE_PHASES[c!.phase].label} · J{c!.dayOfCycle}
          </span>
        </div>
      ))}
    </div>
  );
}

export const cyclePlugin: Plugin = {
  id: "cycle",
  name: "Cycle menstruel",
  tagline: "Suivi du cycle intégré au persona : règles, fenêtre fertile, prévisions.",
  icon: Flower2,
  color: "#f43f5e",
  category: "famille",
  defaultOn: true,
  links: ["workplan"],
  chips: (day, s) => {
    const out: PersonaChip[] = [];
    for (const p of s.personas) {
      if (!p.cycle?.enabled || p.hidden) continue;
      const c = cycleDay(p.cycle, day);
      if (!c) continue;
      if (p.cycle.discreet) {
        if (c.phase === "regles")
          out.push({ id: `cy-${p.id}`, personaId: p.id, icon: Sparkles, label: "•", color: "#a1a1aa", order: 5 });
        continue;
      }
      if (c.phase === "regles" || c.phase === "ovulation" || c.phase === "fertile")
        out.push({
          id: `cy-${p.id}`,
          personaId: p.id,
          icon: c.phase === "regles" ? Droplet : Sparkles,
          label: `${CYCLE_PHASES[c.phase].label} (J${c.dayOfCycle})`,
          color: CYCLE_PHASES[c.phase].color,
          order: 5,
        });
    }
    return out;
  },
  personaSection: PersonaSection,
  dayDetail: DayDetail,
};

