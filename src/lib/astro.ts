import SunCalc from "suncalc";
import type { GeoPlace } from "./types";

export const DEFAULT_PLACE: GeoPlace = { name: "Paris", lat: 48.8566, lon: 2.3522, country: "France" };

export interface SunInfo {
  sunrise: Date;
  sunset: Date;
  dayLength: number;
}

export function sunOf(day: Date, place: GeoPlace | null): SunInfo {
  const p = place ?? DEFAULT_PLACE;
  const noon = new Date(day);
  noon.setHours(12, 0, 0, 0);
  const t = SunCalc.getTimes(noon, p.lat, p.lon);
  return {
    sunrise: t.sunrise,
    sunset: t.sunset,
    dayLength: (t.sunset.getTime() - t.sunrise.getTime()) / 60000,
  };
}

export const MOON_NAMES = [
  "Nouvelle lune",
  "Premier croissant",
  "Premier quartier",
  "Gibbeuse croissante",
  "Pleine lune",
  "Gibbeuse décroissante",
  "Dernier quartier",
  "Dernier croissant",
];

export interface MoonInfo {
  /** 0 = nouvelle, 0.5 = pleine, 1 = nouvelle. */
  phase: number;
  fraction: number;
  index: number;
  name: string;
  /** Vrai le jour où la phase principale tombe. */
  isKey: boolean;
}

const moonCache = new Map<string, MoonInfo>();

export function moonOf(day: Date): MoonInfo {
  const key = day.toDateString();
  const hit = moonCache.get(key);
  if (hit) return hit;
  const at = (h: number) => {
    const d = new Date(day);
    d.setHours(h, 0, 0, 0);
    return SunCalc.getMoonIllumination(d);
  };
  const m = at(12);
  const index = Math.round(m.phase * 8) % 8;
  // Phase principale (nouvelle, quartiers, pleine) atteinte pendant cette journée ?
  const a = at(0).phase;
  const b = at(24).phase;
  const crosses = (t: number) =>
    t === 0 ? b < a : (a <= t && b >= t) || (b < a && (t >= a || t <= b));
  const isKey = [0, 0.25, 0.5, 0.75].some(crosses);
  const info: MoonInfo = { phase: m.phase, fraction: m.fraction, index, name: MOON_NAMES[index], isKey };
  moonCache.set(key, info);
  return info;
}
