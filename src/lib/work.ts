import { differenceInCalendarDays } from "date-fns";
import { dayKey, fromKey, inRange, minutesOf } from "./dates";
import { holidayOn } from "./holidays";
import type { Leave, LeaveType, ShiftType, WorkPattern } from "./types";

export const SHIFT_TYPES: ShiftType[] = [
  { code: "M", label: "Matin", icon: "morning", start: "05:00", end: "13:00", color: "#fbbf24" },
  { code: "A", label: "Après-midi", icon: "afternoon", start: "13:00", end: "21:00", color: "#fb923c" },
  { code: "N", label: "Nuit", icon: "night", start: "21:00", end: "05:00", color: "#818cf8" },
  { code: "J", label: "Journée", icon: "day", start: "08:30", end: "17:30", color: "#38bdf8" },
  { code: "S", label: "Soirée", icon: "evening", start: "17:00", end: "23:00", color: "#c084fc" },
  { code: "T", label: "Télétravail", icon: "remote", start: "09:00", end: "17:00", color: "#2dd4bf" },
  { code: "J12", label: "12 h jour", icon: "day", start: "07:00", end: "19:00", color: "#0ea5e9" },
  { code: "N12", label: "12 h nuit", icon: "night", start: "19:00", end: "07:00", color: "#6366f1" },
  { code: "R", label: "Repos", icon: "rest", start: "00:00", end: "00:00", color: "#52525b", off: true },
];

export const shiftByCode = new Map(SHIFT_TYPES.map((s) => [s.code, s]));

export const shiftHours = (s: ShiftType) => {
  if (s.off) return 0;
  let m = minutesOf(s.end) - minutesOf(s.start);
  if (m <= 0) m += 24 * 60;
  return m / 60;
};

/** Rythmes prêts à l'emploi (un code par jour, en partant d'un lundi). */
export const PRESETS: { id: string; name: string; hint: string; cycle: string[] }[] = [
  { id: "bureau", name: "Bureau 5/2", hint: "Lundi → vendredi en journée", cycle: ["J", "J", "J", "J", "J", "R", "R"] },
  { id: "hybride", name: "Hybride", hint: "3 jours sur site, 2 en télétravail", cycle: ["J", "T", "J", "T", "J", "R", "R"] },
  { id: "2x8", name: "2×8 alterné", hint: "Une semaine matin, une semaine après-midi", cycle: [..."MMMMMRR", ..."AAAAARR"] },
  { id: "3x8", name: "3×8 continu (usine)", hint: "2 matins, 2 après-midi, 2 nuits, 2 repos", cycle: [..."MMAANNRR"] },
  { id: "3x8-sem", name: "3×8 semaine", hint: "Semaine matin / après-midi / nuit", cycle: [..."MMMMMRR", ..."AAAAARR", ..."NNNNNRR"] },
  { id: "5x8", name: "5×8", hint: "2 matins, 2 après-midi, 2 nuits, 4 repos", cycle: [..."MMAANNRRRR"] },
  { id: "4-3", name: "4 jours / 3 off", hint: "Semaine de 4 jours", cycle: ["J", "J", "J", "J", "R", "R", "R"] },
  { id: "12h", name: "12 h (hôpital)", hint: "2 jours, 2 nuits, 4 repos", cycle: ["J12", "J12", "N12", "N12", "R", "R", "R", "R"] },
  { id: "nuit", name: "Nuit fixe", hint: "Veilleur, 5 nuits", cycle: ["N", "N", "N", "N", "N", "R", "R"] },
];

export const LEAVE_TYPES: Record<LeaveType, { label: string; color: string }> = {
  CP: { label: "Congés payés", color: "#34d399" },
  RTT: { label: "RTT", color: "#a3e635" },
  maladie: { label: "Arrêt maladie", color: "#f87171" },
  formation: { label: "Formation", color: "#60a5fa" },
  "sans-solde": { label: "Sans solde", color: "#a1a1aa" },
  recup: { label: "Récupération", color: "#facc15" },
};

export interface DayWork {
  personaId: string;
  shift?: ShiftType;
  leave?: Leave;
  holiday?: string;
}

/** Ce que fait une personne un jour donné : congé > férié > poste du rythme. */
export function workOn(
  personaId: string,
  day: Date,
  patterns: WorkPattern[],
  leaves: Leave[],
): DayWork | null {
  const k = dayKey(day);
  const leave = leaves.find((l) => l.personaId === personaId && inRange(k, l.start, l.end));
  const pattern = patterns.find(
    (p) => p.personaId === personaId && k >= p.from && (!p.to || k <= p.to),
  );
  if (!pattern && !leave) return null;
  if (leave) return { personaId, leave };
  if (!pattern || pattern.cycle.length === 0) return null;
  const holiday = pattern.skipHolidays ? holidayOn(day) : undefined;
  const n = differenceInCalendarDays(day, fromKey(pattern.anchor));
  const idx = ((n % pattern.cycle.length) + pattern.cycle.length) % pattern.cycle.length;
  const shift = shiftByCode.get(pattern.cycle[idx]);
  if (holiday && shift && !shift.off) return { personaId, holiday, shift: shiftByCode.get("R") };
  return { personaId, shift };
}

/** Intervalle de travail réel (une nuit déborde sur le lendemain). */
export function shiftInterval(day: Date, s: ShiftType): [Date, Date] | null {
  if (s.off) return null;
  const a = new Date(day);
  a.setHours(0, minutesOf(s.start), 0, 0);
  const b = new Date(day);
  b.setHours(0, minutesOf(s.end), 0, 0);
  if (b <= a) b.setDate(b.getDate() + 1);
  return [a, b];
}
