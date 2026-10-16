import { Moon, Sunrise, Sunset } from "lucide-react";
import { moonOf, sunOf } from "../lib/astro";
import { hhmm } from "../lib/dates";
import { useApp } from "../store/store";
import { MoonGlyph } from "../components/ui/icons";
import type { Plugin } from "./types";

export const MOON_SHORT = ["Nouvelle", "Croissant", "1er quart.", "Gibbeuse", "Pleine", "Gibbeuse", "Dern. quart.", "Croissant"];

function DayDetail({ day }: { day: Date }) {
  const place = useApp((s) => s.settings.place);
  const sun = sunOf(day, place);
  const moon = moonOf(day);
  const h = Math.floor(sun.dayLength / 60);
  const m = Math.round(sun.dayLength % 60);
  // Position du soleil maintenant sur l'arc du jour (0 → 1).
  const now = Date.now();
  const t = Math.min(1, Math.max(0, (now - sun.sunrise.getTime()) / (sun.sunset.getTime() - sun.sunrise.getTime())));
  const isToday = new Date().toDateString() === day.toDateString();
  const x = 10 + t * 180;
  const y = 52 - Math.sin(t * Math.PI) * 42;
  return (
    <div className="rounded-xl border border-line bg-base/60 p-3">
      <svg viewBox="0 0 200 60" className="w-full h-14">
        <path d="M10 52 Q100 -32 190 52" fill="none" stroke="rgba(251,191,36,0.35)" strokeWidth="1.5" strokeDasharray="3 3" />
        <line x1="0" y1="52" x2="200" y2="52" stroke="var(--color-line2)" />
        {isToday && t > 0 && t < 1 && <circle cx={x} cy={y} r="5" fill="#fbbf24" className="now-dot" />}
      </svg>
      <div className="mt-1 grid grid-cols-3 text-[12px]">
        <span className="flex items-center gap-1.5 text-muted">
          <Sunrise size={14} className="text-amber-400" />
          <span className="text-fg tabular">{hhmm(sun.sunrise)}</span>
        </span>
        <span className="text-center text-muted">
          {h} h {String(m).padStart(2, "0")} de jour
        </span>
        <span className="flex items-center justify-end gap-1.5 text-muted">
          <span className="text-fg tabular">{hhmm(sun.sunset)}</span>
          <Sunset size={14} className="text-orange-400" />
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5 border-t border-line pt-2.5">
        <MoonGlyph phase={moon.phase} size={26} />
        <div className="text-[12.5px]">
          <div className="text-bright">{moon.name}</div>
          <div className="text-muted">Éclairée à {Math.round(moon.fraction * 100)} %</div>
        </div>
      </div>
    </div>
  );
}

function Status() {
  const moon = moonOf(new Date());
  return (
    <span className="flex items-center gap-1.5" title={`${moon.name} — ${Math.round(moon.fraction * 100)} %`}>
      <MoonGlyph phase={moon.phase} size={13} />
      <span className="hidden lg:inline">{moon.name}</span>
    </span>
  );
}

export const astroPlugin: Plugin = {
  id: "astro",
  name: "Lune & soleil",
  tagline: "Phases de lune, lever et coucher du soleil, heures de nuit grisées.",
  icon: Moon,
  color: "#fbbf24",
  category: "temps",
  defaultOn: true,
  links: ["weather", "workplan"],
  badges: (day) => {
    const m = moonOf(day);
    // Partage la place de la météo : 1,5 s de lune après 3 s de météo.
    return [
      {
        id: "moon",
        order: 2,
        cycle: 1500,
        title: m.name,
        node: (
          <span className="flex items-center gap-0.5">
            <MoonGlyph phase={m.phase} size={13} />
            <span className="text-[10px] text-muted whitespace-nowrap">{MOON_SHORT[m.index]}</span>
          </span>
        ),
      },
    ];
  },
  shade: (day, s) => {
    const sun = sunOf(day, s.settings.place);
    const rise = sun.sunrise.getHours() * 60 + sun.sunrise.getMinutes();
    const set = sun.sunset.getHours() * 60 + sun.sunset.getMinutes();
    return [
      { from: 0, to: rise, label: `Lever ${hhmm(sun.sunrise)}` },
      { from: set, to: 24 * 60, label: `Coucher ${hhmm(sun.sunset)}` },
    ];
  },
  dayDetail: DayDetail,
  status: Status,
};
