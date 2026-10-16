import { CloudSun, Droplets, RefreshCw, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_PLACE } from "../lib/astro";
import { dayKey, fmt } from "../lib/dates";
import { fetchWeather, weatherKind } from "../lib/weather";
import { useApp } from "../store/store";
import { WEATHER_ICONS } from "../components/ui/icons";
import type { Plugin } from "./types";

const STALE = 60 * 60 * 1000;

function useBoot() {
  const place = useApp((s) => s.settings.place);
  const weather = useApp((s) => s.cache.weather);
  const setCache = useApp((s) => s.setCache);
  useEffect(() => {
    const p = place ?? DEFAULT_PLACE;
    const load = () =>
      fetchWeather(p)
        .then((w) => setCache({ weather: w }))
        .catch(() => {});
    if (!weather || weather.place !== p.name || Date.now() - weather.fetchedAt > STALE) load();
    const t = setInterval(load, STALE);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.lat, place?.lon]);
}

export function WeatherIcon({ code, size = 14 }: { code: number; size?: number }) {
  const { kind } = weatherKind(code);
  const { icon: Icon, color } = WEATHER_ICONS[kind];
  return <Icon size={size} color={color} strokeWidth={2} />;
}

function DayDetail({ day }: { day: Date }) {
  const w = useApp((s) => s.cache.weather);
  const d = w?.daily.find((x) => x.date === dayKey(day));
  if (!w || !d) return null;
  const hours = w.hourly.filter((h) => h.time.startsWith(d.date)).filter((_, i) => i % 3 === 0);
  return (
    <div className="rounded-xl border border-line bg-base/60 p-3">
      <div className="flex items-center gap-3">
        <WeatherIcon code={d.code} size={30} />
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-bright">
            {Math.round(d.tmax)}° <span className="text-muted font-normal">/ {Math.round(d.tmin)}°</span>
          </div>
          <div className="text-[12px] text-muted">
            {weatherKind(d.code).label} · {w.place}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-[11.5px] text-muted">
          <span className="flex items-center gap-1">
            <Droplets size={12} className="text-sky-400" /> {d.rain}%
          </span>
          <span className="flex items-center gap-1">
            <Wind size={12} /> {Math.round(d.wind)} km/h
          </span>
        </div>
      </div>
      {hours.length > 0 && (
        <div className="mt-3 grid grid-cols-8 gap-1">
          {hours.map((h) => (
            <div key={h.time} className="flex flex-col items-center gap-1 rounded-lg py-1 text-[10.5px] text-muted">
              <span>{h.time.slice(11, 13)}h</span>
              <WeatherIcon code={h.code} size={14} />
              <span className="text-fg tabular">{Math.round(h.temp)}°</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Status() {
  const w = useApp((s) => s.cache.weather);
  const setCache = useApp((s) => s.setCache);
  const place = useApp((s) => s.settings.place);
  const [spin, setSpin] = useState(false);
  if (!w) return null;
  return (
    <button
      className="flex items-center gap-1.5 hover:text-bright cursor-pointer"
      title={`Météo à ${w.place} — mise à jour ${fmt(new Date(w.fetchedAt), "HH:mm")}. Cliquer pour actualiser.`}
      onClick={() => {
        setSpin(true);
        fetchWeather(place ?? DEFAULT_PLACE)
          .then((x) => setCache({ weather: x }))
          .finally(() => setSpin(false));
      }}
    >
      {spin ? <RefreshCw size={13} className="animate-spin" /> : <WeatherIcon code={w.current.code} size={14} />}
      <span className="tabular">{Math.round(w.current.temp)}°</span>
      <span className="hidden md:inline">{w.place}</span>
    </button>
  );
}

export const weatherPlugin: Plugin = {
  id: "weather",
  name: "Météo",
  tagline: "Prévisions à 16 jours dans chaque case, détail heure par heure.",
  icon: CloudSun,
  color: "#38bdf8",
  category: "temps",
  defaultOn: true,
  links: ["astro", "deliveries"],
  useBoot,
  badges: (day, s) => {
    const d = s.cache.weather?.daily.find((x) => x.date === dayKey(day));
    if (!d) return [];
    return [
      {
        id: "w",
        order: 1,
        title: `${weatherKind(d.code).label} · ${Math.round(d.tmin)}° / ${Math.round(d.tmax)}° · pluie ${d.rain}%`,
        node: (
          <span className="flex items-center gap-0.5">
            <WeatherIcon code={d.code} size={13} />
            <span className="text-[10.5px] tabular text-muted">{Math.round(d.tmax)}°</span>
          </span>
        ),
      },
    ];
  },
  dayDetail: DayDetail,
  status: Status,
};
