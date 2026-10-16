import type { GeoPlace } from "./types";

// Open-Meteo : gratuit, sans clé, prévisions à 16 jours.

export interface DailyWeather {
  date: string;
  code: number;
  tmax: number;
  tmin: number;
  rain: number;
  wind: number;
}

export interface HourlyWeather {
  time: string;
  temp: number;
  code: number;
}

export interface WeatherData {
  fetchedAt: number;
  place: string;
  current: { temp: number; code: number; wind: number };
  daily: DailyWeather[];
  hourly: HourlyWeather[];
}

export async function fetchWeather(p: GeoPlace): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=auto&forecast_days=16`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Météo indisponible (${res.status})`);
  const j = await res.json();
  return {
    fetchedAt: Date.now(),
    place: p.name,
    current: {
      temp: j.current.temperature_2m,
      code: j.current.weather_code,
      wind: j.current.wind_speed_10m,
    },
    daily: j.daily.time.map((t: string, i: number) => ({
      date: t,
      code: j.daily.weather_code[i],
      tmax: j.daily.temperature_2m_max[i],
      tmin: j.daily.temperature_2m_min[i],
      rain: j.daily.precipitation_probability_max[i] ?? 0,
      wind: j.daily.wind_speed_10m_max[i],
    })),
    hourly: j.hourly.time.map((t: string, i: number) => ({
      time: t,
      temp: j.hourly.temperature_2m[i],
      code: j.hourly.weather_code[i],
    })),
  };
}

export async function searchPlaces(q: string): Promise<GeoPlace[]> {
  if (q.trim().length < 2) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=fr`,
  );
  if (!res.ok) return [];
  const j = await res.json();
  return (j.results ?? []).map((r: { name: string; latitude: number; longitude: number; country?: string; admin1?: string }) => ({
    name: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
    lat: r.latitude,
    lon: r.longitude,
    country: r.country,
  }));
}

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

/** Codes WMO → famille d'icône et libellé. */
export function weatherKind(code: number): { kind: WeatherKind; label: string } {
  if (code === 0) return { kind: "clear", label: "Ensoleillé" };
  if (code <= 2) return { kind: "partly", label: "Éclaircies" };
  if (code === 3) return { kind: "cloudy", label: "Couvert" };
  if (code <= 48) return { kind: "fog", label: "Brouillard" };
  if (code <= 57) return { kind: "drizzle", label: "Bruine" };
  if (code <= 67 || (code >= 80 && code <= 82)) return { kind: "rain", label: "Pluie" };
  if (code <= 77 || code === 85 || code === 86) return { kind: "snow", label: "Neige" };
  return { kind: "storm", label: "Orage" };
}
