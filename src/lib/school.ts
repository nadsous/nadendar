import { addDays, differenceInCalendarDays, startOfWeek } from "date-fns";
import { dayKey, fromKey, WEEK } from "./dates";
import type { SchoolSettings, SchoolZone } from "./types";

// Calendrier scolaire officiel (open data de l'Éducation nationale).

export interface SchoolHoliday {
  name: string;
  /** Premier jour sans classe. */
  start: string;
  /** Dernier jour sans classe. */
  end: string;
}

export async function fetchSchoolHolidays(zone: SchoolZone): Promise<SchoolHoliday[]> {
  const now = new Date();
  const from = `${now.getFullYear() - 1}-08-01`;
  const where = `zones="${zone}" AND start_date>="${from}"`;
  const url =
    "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records" +
    `?where=${encodeURIComponent(where)}&order_by=start_date&limit=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Calendrier scolaire indisponible (${res.status})`);
  const j = await res.json();
  const seen = new Set<string>();
  const out: SchoolHoliday[] = [];
  for (const r of j.results ?? []) {
    if (r.population && r.population !== "-" && r.population !== "Élèves") continue;
    const start = toLocalDay(r.start_date, 0);
    // end_date est le jour de reprise : le dernier jour de vacances est la veille.
    const end = toLocalDay(r.end_date, -1);
    const key = `${r.description}|${start}`;
    if (seen.has(key) || end < start) continue;
    seen.add(key);
    out.push({ name: r.description, start, end });
  }
  return out;
}

function toLocalDay(iso: string, shift: number) {
  const d = new Date(iso);
  // Les dates arrivent en UTC la veille à 23 h : on arrondit au jour le plus proche.
  d.setHours(d.getHours() + 12);
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
}

export const WEEK_LETTERS = ["A", "B", "C", "D"];

/** Semaine de l'alternance (0 = A, 1 = B…) qui contient le jour `d`. */
export function rotationWeek(sc: SchoolSettings, d: Date, holidays?: SchoolHoliday[]): number {
  const n = Math.max(1, Math.min(4, sc.rotation ?? 1));
  if (n === 1) return 0;
  const mon = startOfWeek(d, WEEK);
  const anchor = sc.rotationAnchor ? startOfWeek(fromKey(sc.rotationAnchor), WEEK) : mon;
  let weeks = Math.round(differenceInCalendarDays(mon, anchor) / 7);
  if (sc.rotationPauses && holidays?.length && weeks !== 0) {
    // Les semaines entièrement en vacances (lundi → vendredi) ne comptent pas.
    const [lo, hi] = weeks > 0 ? [anchor, mon] : [mon, anchor];
    let paused = 0;
    for (const h of holidays) {
      let m = startOfWeek(fromKey(h.start), WEEK);
      if (dayKey(m) < h.start) m = addDays(m, 7);
      for (; dayKey(addDays(m, 4)) <= h.end; m = addDays(m, 7)) if (m >= lo && m < hi) paused++;
    }
    weeks += weeks > 0 ? -paused : paused;
  }
  return (((sc.rotationAnchorWeek ?? 0) + weeks) % n + n) % n;
}
