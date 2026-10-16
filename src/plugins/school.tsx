import { filled } from "../lib/colors";
import { addDays } from "date-fns";
import { Backpack, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { atTime, dayKey, inRange, isoWeekday, uid } from "../lib/dates";
import { holidayOn } from "../lib/holidays";
import { fetchSchoolHolidays, type SchoolHoliday } from "../lib/school";
import type { Persona, SchoolSettings, SchoolSlot } from "../lib/types";
import { useApp } from "../store/store";
import { Button, Field, PALETTE, Toggle } from "../components/ui/ui";
import type { CalItem, Plugin } from "./types";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const STALE = 7 * 24 * 3600 * 1000;

function useBoot() {
  const zone = useApp((s) => s.settings.schoolZone);
  const cached = useApp((s) => s.cache.schoolHolidays);
  const setCache = useApp((s) => s.setCache);
  useEffect(() => {
    if (cached && cached.zone === zone && Date.now() - cached.fetchedAt < STALE) return;
    fetchSchoolHolidays(zone)
      .then((list) => setCache({ schoolHolidays: { zone, fetchedAt: Date.now(), list } }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone]);
}

export const schoolHolidayOn = (k: string, list: SchoolHoliday[] | undefined) =>
  list?.find((h) => inRange(k, h.start, h.end));

const emptySchool = (): SchoolSettings => ({
  enabled: true,
  level: "",
  establishment: "",
  timetable: [],
  followHolidays: true,
});

function PersonaSection({ persona, onChange }: { persona: Persona; onChange: (p: Partial<Persona>) => void }) {
  const sc = persona.school;
  if (!sc?.enabled)
    return (
      <div className="flex items-center gap-3">
        <Toggle on={false} onChange={() => onChange({ school: { ...emptySchool(), ...sc, enabled: true } })} />
        <span className="text-[12.5px] text-muted">Activer l'emploi du temps scolaire</span>
      </div>
    );
  const set = (p: Partial<SchoolSettings>) => onChange({ school: { ...sc, ...p } });
  const setSlot = (id: string, p: Partial<SchoolSlot>) => set({ timetable: sc.timetable.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const addSlot = (weekday: number) => {
    const last = sc.timetable.filter((s) => s.weekday === weekday).sort((a, b) => a.end.localeCompare(b.end)).pop();
    set({
      timetable: [
        ...sc.timetable,
        {
          id: uid(),
          weekday,
          start: last?.end ?? "08:30",
          end: last ? addHour(last.end) : "11:30",
          subject: "École",
          color: PALETTE[(sc.timetable.length * 3) % PALETTE.length],
        },
      ],
    });
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <Toggle on onChange={() => set({ enabled: false })} />
        <span className="text-[12.5px]">Emploi du temps scolaire</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Classe">
          <input className="field" value={sc.level} placeholder="CM1, 5e, Terminale…" onChange={(e) => set({ level: e.target.value })} />
        </Field>
        <Field label="Établissement">
          <input className="field" value={sc.establishment} placeholder="École Jules Ferry" onChange={(e) => set({ establishment: e.target.value })} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Toggle on={sc.followHolidays} onChange={(v) => set({ followHolidays: v })} />
        <span className="text-[12.5px]">Pas de cours pendant les vacances et les fériés</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {WEEKDAYS.map((label, i) => {
          const wd = i + 1;
          const slots = sc.timetable.filter((s) => s.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <div key={wd} className="rounded-xl border border-line bg-base/50 p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-medium text-fg">{label}</span>
                <button className="text-muted hover:text-brand cursor-pointer" onClick={() => addSlot(wd)} aria-label="Ajouter un cours">
                  <Plus size={14} />
                </button>
              </div>
              <div className="grid gap-1">
                {slots.map((s) => (
                  <div key={s.id} className="rounded-lg p-1.5" style={filled(s.color)}>
                    <div className="flex items-center gap-1">
                      <input
                        className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-inherit outline-none"
                        value={s.subject}
                        onChange={(e) => setSlot(s.id, { subject: e.target.value })}
                      />
                      <button className="opacity-60 hover:opacity-100 cursor-pointer" onClick={() => set({ timetable: sc.timetable.filter((x) => x.id !== s.id) })} aria-label="Supprimer">
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] opacity-85">
                      <input type="time" className="bg-transparent outline-none tabular" value={s.start} onChange={(e) => setSlot(s.id, { start: e.target.value })} />
                      –
                      <input type="time" className="bg-transparent outline-none tabular" value={s.end} onChange={(e) => setSlot(s.id, { end: e.target.value })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Button
        size="sm"
        className="justify-self-start"
        onClick={() =>
          set({
            timetable: [1, 2, 4, 5].flatMap((wd) => [
              { id: uid(), weekday: wd, start: "08:30", end: "11:30", subject: "Matin", color: "#38bdf8" },
              { id: uid(), weekday: wd, start: "13:30", end: "16:30", subject: "Après-midi", color: "#a78bfa" },
            ]),
          })
        }
      >
        Remplir : semaine de 4 jours (primaire)
      </Button>
    </div>
  );
}

function addHour(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function DayDetail({ day }: { day: Date }) {
  const list = useApp((s) => s.cache.schoolHolidays?.list);
  const h = schoolHolidayOn(dayKey(day), list);
  if (!h) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[12.5px] text-emerald-300">
      <Backpack size={14} /> {h.name}
    </div>
  );
}

export const schoolPlugin: Plugin = {
  id: "school",
  name: "Planning scolaire",
  tagline: "Emploi du temps des enfants et vacances scolaires officielles par zone.",
  icon: Backpack,
  color: "#34d399",
  category: "famille",
  defaultOn: true,
  links: ["shopping", "workplan"],
  useBoot,
  badges: (day, s) => {
    const h = schoolHolidayOn(dayKey(day), s.cache.schoolHolidays?.list);
    if (!h) return [];
    return [
      {
        id: "vac",
        order: 3,
        title: h.name,
        node: <span className="block h-1.5 w-3 rounded-full bg-emerald-400/70" />,
      },
    ];
  },
  items: (from, to, s) => {
    const out: CalItem[] = [];
    const list = s.cache.schoolHolidays?.list;
    for (const p of s.personas) {
      const sc = p.school;
      if (!sc?.enabled || p.hidden || !sc.timetable.length) continue;
      for (let d = from; d < to; d = addDays(d, 1)) {
        if (sc.followHolidays && (holidayOn(d) || schoolHolidayOn(dayKey(d), list))) continue;
        const wd = isoWeekday(d);
        for (const slot of sc.timetable) {
          if (slot.weekday !== wd) continue;
          out.push({
            id: `school-${slot.id}-${dayKey(d)}`,
            title: `${p.name} · ${slot.subject}`,
            start: atTime(d, slot.start),
            end: atTime(d, slot.end),
            allDay: false,
            color: slot.color,
            personaIds: [p.id],
            icon: Backpack,
            source: "school",
            subtle: true,
          });
        }
      }
    }
    return out;
  },
  personaSection: PersonaSection,
  dayDetail: DayDetail,
};
