import type { SchoolZone } from "./types";

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
