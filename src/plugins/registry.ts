import { CalendarDays, Cake, Stethoscope, Bell } from "lucide-react";
import { useMemo } from "react";

import { expand } from "../lib/recurrence";
import type { EventKind } from "../lib/types";
import { useApp, type AppState } from "../store/store";
import { MEETING } from "../components/ui/icons";
import { astroPlugin } from "./astro";
import { birthdaysPlugin } from "./birthdays";
import { budgetPlugin } from "./budget";
import { cyclePlugin } from "./cycle";
import { deliveriesPlugin } from "./deliveries";
import { externalPlugin } from "./external";
import { ganttPlugin } from "./gantt";
import { holidaysPlugin } from "./holidays";
import { mailPlugin } from "./mail";
import { mealsPlugin } from "./meals";
import { meetingsPlugin } from "./meetings";
import { schoolPlugin } from "./school";
import { shoppingPlugin } from "./shopping";
import { todoPlugin } from "./todo";
import type { CalItem, DayBadge, PersonaChip, Plugin } from "./types";
import { weatherPlugin } from "./weather";
import { workplanPlugin } from "./workplan";

export const PLUGINS: Plugin[] = [
  workplanPlugin,
  meetingsPlugin,
  schoolPlugin,
  cyclePlugin,
  birthdaysPlugin,
  weatherPlugin,
  astroPlugin,
  holidaysPlugin,
  todoPlugin,
  shoppingPlugin,
  mealsPlugin,
  deliveriesPlugin,
  budgetPlugin,
  ganttPlugin,
  mailPlugin,
  externalPlugin,
];

export const pluginById = new Map(PLUGINS.map((p) => [p.id, p]));

export const isOn = (s: Pick<AppState, "settings">, p: Plugin) => s.settings.plugins[p.id] ?? p.defaultOn;

export function useEnabledPlugins() {
  const flags = useApp((s) => s.settings.plugins);
  return useMemo(() => PLUGINS.filter((p) => flags[p.id] ?? p.defaultOn), [flags]);
}

const KIND_ICON: Record<EventKind, typeof CalendarDays> = {
  event: CalendarDays,
  meeting: MEETING.meet.icon,
  appointment: Stethoscope,
  reminder: Bell,
  birthday: Cake,
};

/** Événements du calendrier (le cœur, toujours actif). */
export function coreItems(from: Date, to: Date, s: AppState): CalItem[] {
  const out: CalItem[] = [];
  for (const ev of s.events) {
    const people = ev.personaIds;
    if (people.length && people.every((id) => s.personas.find((p) => p.id === id)?.hidden)) continue;
    for (const o of expand(ev, from, to)) {
      const persona = s.personas.find((p) => p.id === people[0]);
      const meeting = ev.meeting ? MEETING[ev.meeting.provider] : null;
      out.push({
        id: `ev-${ev.id}-${o.start.getTime()}`,
        title: ev.title || "(sans titre)",
        start: o.start,
        // Journée entière : `end` est le dernier jour inclus.
        end: o.end,
        allDay: ev.allDay,
        color: ev.color ?? meeting?.color ?? persona?.color ?? "#fe7146",
        personaIds: people,
        icon: meeting?.icon ?? KIND_ICON[ev.kind],
        source: "core",
        event: ev,
        meta: meeting?.label,
      });
    }
  }
  return out;
}

export function collectItems(from: Date, to: Date, s: AppState, plugins: Plugin[]): CalItem[] {
  const out = coreItems(from, to, s);
  for (const p of plugins) if (p.items) out.push(...p.items(from, to, s));
  return out.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
}

export function collectBadges(day: Date, s: AppState, plugins: Plugin[]): DayBadge[] {
  const out: DayBadge[] = [];
  for (const p of plugins) if (p.badges) out.push(...p.badges(day, s));
  return out.sort((a, b) => a.order - b.order);
}

export function collectChips(day: Date, s: AppState, plugins: Plugin[]): PersonaChip[] {
  const out: PersonaChip[] = [];
  for (const p of plugins) if (p.chips) out.push(...p.chips(day, s));
  return out.sort((a, b) => a.order - b.order);
}

/** Tout ce qu'il faut pour dessiner une plage de jours, recalculé seulement si les données changent. */
export function useCalendarData(from: Date, to: Date) {
  const plugins = useEnabledPlugins();
  const s = useApp();
  const deps = [
    s.events, s.personas, s.patterns, s.leaves, s.todos, s.shopping, s.deliveries, s.meals, s.money,
    s.projects, s.cache, s.settings.place, plugins, from.getTime(), to.getTime(),
  ];
  return useMemo(() => {
    const items = collectItems(from, to, s, plugins);
    return { items, plugins, state: s };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
