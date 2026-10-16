import { addDays, differenceInCalendarDays } from "date-fns";
import { fromKey } from "./dates";
import type { CycleSettings } from "./types";

export type CyclePhase = "regles" | "folliculaire" | "fertile" | "ovulation" | "luteale";

export const CYCLE_PHASES: Record<CyclePhase, { label: string; color: string }> = {
  regles: { label: "Règles", color: "#f43f5e" },
  folliculaire: { label: "Phase folliculaire", color: "#f9a8d4" },
  fertile: { label: "Fenêtre fertile", color: "#a78bfa" },
  ovulation: { label: "Ovulation (estimée)", color: "#8b5cf6" },
  luteale: { label: "Phase lutéale", color: "#fda4af" },
};

/** Durée moyenne du cycle à partir des débuts notés (sinon la valeur réglée). */
export function averageCycle(c: CycleSettings): number {
  const logs = [...new Set([...c.logs, c.lastStart])].sort();
  if (logs.length < 2) return c.cycleLength;
  const gaps: number[] = [];
  for (let i = 1; i < logs.length; i++) {
    const g = differenceInCalendarDays(fromKey(logs[i]), fromKey(logs[i - 1]));
    if (g >= 18 && g <= 45) gaps.push(g);
  }
  if (!gaps.length) return c.cycleLength;
  return Math.round(gaps.slice(-6).reduce((a, b) => a + b, 0) / Math.min(gaps.length, 6));
}

/** Phase estimée d'un jour, ou null si avant le premier début connu. */
export function cycleDay(c: CycleSettings, day: Date): { phase: CyclePhase; dayOfCycle: number } | null {
  const logs = [...new Set([...c.logs, c.lastStart])].sort();
  const len = averageCycle(c);
  const first = fromKey(logs[0]);
  if (day < first) return null;
  // Dernier début noté avant ce jour, puis projection par cycles moyens.
  let ref = first;
  for (const l of logs) {
    const d = fromKey(l);
    if (d <= day) ref = d;
  }
  const diff = differenceInCalendarDays(day, ref);
  const dayOfCycle = (diff % len) + 1;
  const ovu = len - 14;
  let phase: CyclePhase;
  if (dayOfCycle <= c.periodLength) phase = "regles";
  else if (dayOfCycle === ovu) phase = "ovulation";
  else if (dayOfCycle >= ovu - 5 && dayOfCycle <= ovu + 1) phase = "fertile";
  else if (dayOfCycle < ovu) phase = "folliculaire";
  else phase = "luteale";
  return { phase, dayOfCycle };
}

export function nextPeriod(c: CycleSettings, from = new Date()): Date {
  const len = averageCycle(c);
  const logs = [...new Set([...c.logs, c.lastStart])].sort();
  let d = fromKey(logs[logs.length - 1]);
  while (d < from) d = addDays(d, len);
  return d;
}
