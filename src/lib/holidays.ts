import { addDays } from "date-fns";
import { dayKey } from "./dates";
import type { DayKey } from "./types";

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher). */
function easter(y: number): Date {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

const cache = new Map<number, Map<DayKey, string>>();

/** Jours fériés de France métropolitaine pour une année. */
export function holidaysOf(y: number): Map<DayKey, string> {
  const hit = cache.get(y);
  if (hit) return hit;
  const e = easter(y);
  const list: [Date, string][] = [
    [new Date(y, 0, 1), "Jour de l'an"],
    [addDays(e, 1), "Lundi de Pâques"],
    [new Date(y, 4, 1), "Fête du Travail"],
    [new Date(y, 4, 8), "Victoire 1945"],
    [addDays(e, 39), "Ascension"],
    [addDays(e, 50), "Lundi de Pentecôte"],
    [new Date(y, 6, 14), "Fête nationale"],
    [new Date(y, 7, 15), "Assomption"],
    [new Date(y, 10, 1), "Toussaint"],
    [new Date(y, 10, 11), "Armistice 1918"],
    [new Date(y, 11, 25), "Noël"],
  ];
  const map = new Map(list.map(([d, n]) => [dayKey(d), n]));
  cache.set(y, map);
  return map;
}

export const holidayOn = (d: Date) => holidaysOf(d.getFullYear()).get(dayKey(d));
