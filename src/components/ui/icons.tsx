import {
  Briefcase,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Coffee,
  GraduationCap,
  Laptop,
  MapPin,
  MessageCircle,
  Moon,
  Palmtree,
  Phone,
  Stethoscope,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Timer,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { memo } from "react";
import type { LeaveType, MeetingProvider, ShiftIcon } from "../../lib/types";
import type { WeatherKind } from "../../lib/weather";

export const SHIFT_ICONS: Record<ShiftIcon, LucideIcon> = {
  morning: Sunrise,
  afternoon: Sunset,
  night: Moon,
  day: Sun,
  evening: CloudMoon,
  remote: Laptop,
  rest: Coffee,
};

export const LEAVE_ICONS: Record<LeaveType, LucideIcon> = {
  CP: Palmtree,
  RTT: Timer,
  maladie: Thermometer,
  formation: GraduationCap,
  "sans-solde": Wallet,
  recup: Coffee,
};

export const MEETING: Record<MeetingProvider, { label: string; icon: LucideIcon; color: string; hint: string }> = {
  meet: { label: "Google Meet", icon: Video, color: "#22c55e", hint: "https://meet.google.com/…" },
  teams: { label: "Microsoft Teams", icon: Video, color: "#6366f1", hint: "https://teams.microsoft.com/…" },
  zoom: { label: "Zoom", icon: Video, color: "#3b82f6", hint: "https://zoom.us/j/…" },
  doctolib: { label: "Doctolib", icon: Stethoscope, color: "#0ea5e9", hint: "https://www.doctolib.fr/…" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "#10b981", hint: "https://wa.me/…" },
  telephone: { label: "Téléphone", icon: Phone, color: "#a3a3a3", hint: "06 …" },
  presentiel: { label: "Sur place", icon: MapPin, color: "#f59e0b", hint: "Adresse" },
  autre: { label: "Autre lien", icon: Briefcase, color: "#8b8b95", hint: "https://…" },
};

/** Devine le service à partir d'un lien collé. */
export function guessProvider(url: string): MeetingProvider | null {
  const u = url.toLowerCase();
  if (u.includes("meet.google")) return "meet";
  if (u.includes("teams.microsoft") || u.includes("teams.live")) return "teams";
  if (u.includes("zoom.us")) return "zoom";
  if (u.includes("doctolib")) return "doctolib";
  if (u.includes("wa.me") || u.includes("whatsapp")) return "whatsapp";
  return null;
}

export const WEATHER_ICONS: Record<WeatherKind, { icon: LucideIcon; color: string }> = {
  clear: { icon: Sun, color: "#fbbf24" },
  partly: { icon: CloudSun, color: "#fcd34d" },
  cloudy: { icon: Cloud, color: "#a1a1aa" },
  fog: { icon: CloudFog, color: "#a1a1aa" },
  drizzle: { icon: CloudDrizzle, color: "#7dd3fc" },
  rain: { icon: CloudRain, color: "#38bdf8" },
  snow: { icon: CloudSnow, color: "#e0f2fe" },
  storm: { icon: CloudLightning, color: "#c084fc" },
};

/** Lune dessinée avec sa vraie fraction éclairée (0 → 1 → 0 sur un cycle). */
export const MoonGlyph = memo(function MoonGlyph({ phase, size = 14 }: { phase: number; size?: number }) {
  const r = 10;
  // Demi-largeur du terminateur : de r (nouvelle) à 0 (quartier) à r (pleine).
  const k = Math.cos(phase * 2 * Math.PI) * r;
  const waxing = phase < 0.5;
  const lit = "#f4f1de";
  const dark = "#2a2a31";
  const outer = waxing ? 1 : 0; // côté éclairé : droite en croissance
  // Croissant croissant / gibbeuse décroissante : le terminateur bombe vers la droite.
  const sweepInner = phase < 0.25 || (phase >= 0.5 && phase < 0.75) ? 0 : 1;
  const d =
    `M12 2 A${r} ${r} 0 0 ${outer} 12 22 ` +
    `A${Math.abs(k).toFixed(2)} ${r} 0 0 ${sweepInner} 12 2Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r={r} fill={dark} stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
      <path d={d} fill={lit} />
    </svg>
  );
});
