import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import type { DayKey } from "./types";

export const WEEK = { weekStartsOn: 1 as const };

export const dayKey = (d: Date): DayKey => format(d, "yyyy-MM-dd");
export const fromKey = (k: DayKey): Date => parseISO(k);
export const isoLocal = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
export const parseLocal = (s: string) => parseISO(s);

export const fmt = (d: Date, f: string) => format(d, f, { locale: fr });
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Jours de la grille du mois (semaines complètes, lundi en premier). */
export function monthGrid(anchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(anchor), WEEK);
  const end = endOfWeek(endOfMonth(anchor), WEEK);
  const n = differenceInCalendarDays(end, start) + 1;
  // Toujours 6 semaines : la grille ne saute pas d'un mois à l'autre.
  return Array.from({ length: Math.max(n, 42) }, (_, i) => addDays(start, i));
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, WEEK);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 1 = lundi … 7 = dimanche. */
export const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;

export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export const atTime = (day: Date, hhmm: string) => {
  const d = new Date(day);
  const m = minutesOf(hhmm);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};

export const hhmm = (d: Date) => format(d, "HH:mm");

export const inRange = (k: DayKey, a: DayKey, b: DayKey) => k >= a && k <= b;

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const euros = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
