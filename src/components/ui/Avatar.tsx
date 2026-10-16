import { memo } from "react";
import { diceUri } from "../../lib/avatars";
import type { AvatarSpec, Persona } from "../../lib/types";

// Avatars façon Notion : trait noir, aplat de cheveux, fond à la couleur du persona.

export const SKINS = ["#ffffff", "#fde7d6", "#f2c9a5", "#dca47a", "#b77b52", "#7a4c31", "#4f3121"];

const INK = "#141416";

export const defaultAvatar = (gender: AvatarSpec["gender"] = "neutre"): AvatarSpec => ({
  gender,
  hair: gender === "femme" ? "long" : gender === "homme" ? "court" : "mi-long",
  glasses: false,
  beard: false,
  skin: 0,
});

function HairBack({ spec }: { spec: AvatarSpec }) {
  if (spec.hair === "long")
    return <path d="M16.5 55 C13 30 18 11.5 32 11.5 C46 11.5 51 30 47.5 55Z" fill={INK} />;
  if (spec.hair === "mi-long")
    return <path d="M17.5 44 C15 25 20 12 32 12 C44 12 49 25 46.5 44Z" fill={INK} />;
  if (spec.hair === "queue")
    return <path d="M43 21 C53 22 56 36 49 47 C50 38 48 31 42.5 28Z" fill={INK} />;
  if (spec.hair === "chignon") return <circle cx="32" cy="10.5" r="6.5" fill={INK} />;
  return null;
}

function HairFront({ spec }: { spec: AvatarSpec }) {
  switch (spec.hair) {
    case "court":
      return (
        <path
          d="M19.5 29 C18.5 17 25 13 32 13 C40 13 45.5 18 44.5 29 C43 22.5 38 20 33 20.5 C27 21 22.5 23.5 19.5 29Z"
          fill={INK}
        />
      );
    case "mi-long":
    case "long":
    case "queue":
    case "chignon":
      return (
        <path
          d="M19.6 28 C20.5 18.5 26.5 15 32.5 15 C39 15 44.5 19 44.4 28 C40.5 22.5 34 21.5 28.5 22.5 C25 23.2 22 25.3 19.6 28Z"
          fill={INK}
        />
      );
    case "boucle":
      return (
        <g fill={INK}>
          {[
            [20, 25, 5.5],
            [22.5, 18.5, 6],
            [29, 14.5, 6.5],
            [36, 14.5, 6.5],
            [42, 18.5, 6],
            [44.5, 25, 5.5],
          ].map(([x, y, r]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>
      );
    default:
      return <path d="M25 19.5 q3 -1.5 6 -1" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.35" />;
  }
}

function Face({ spec, small }: { spec: AvatarSpec; small?: boolean }) {
  const fem = spec.gender === "femme";
  const mouthColor = spec.beard ? "#ffffff" : INK;
  return (
    <>
      {/* Épaules */}
      <path d="M13 64 C14.5 52.5 23 48 32 48 C41 48 49.5 52.5 51 64Z" fill="#ffffff" stroke={INK} strokeWidth="2.2" />
      <path d="M28 48.3 L32 53 L36 48.3" fill="none" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      {/* Cou */}
      <path d="M28.5 41 L28.5 48.5 M35.5 41 L35.5 48.5" stroke={INK} strokeWidth="2.2" />
      {/* Visage */}
      <ellipse cx="32" cy="30.5" rx="12.4" ry="13.6" fill={SKINS[spec.skin] ?? SKINS[0]} stroke={INK} strokeWidth="2.2" />
      {spec.beard && (
        <path d="M19.8 32 C20 43 25.5 46.6 32 46.6 C38.5 46.6 44 43 44.2 32 C42.5 37.5 38.5 39.6 32 39.6 C25.5 39.6 21.5 37.5 19.8 32Z" fill={INK} />
      )}
      {/* Yeux */}
      <ellipse cx="27" cy="30.5" rx="1.55" ry="1.85" fill={INK} />
      <ellipse cx="37" cy="30.5" rx="1.55" ry="1.85" fill={INK} />
      {fem && !small && (
        <path d="M25 28.6 l-1.3 -1.1 M39 28.6 l1.3 -1.1" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
      )}
      {/* Sourcils */}
      <path d="M24.8 26.2 q2.2 -1.3 4.4 -0.3 M34.8 25.9 q2.2 -1 4.4 0.3" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Nez */}
      <path d="M32.3 31.5 q-1.6 3.6 0.6 4" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
      {/* Bouche */}
      <path d="M28.6 38 q3.4 2.8 6.8 0" stroke={mouthColor} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {(fem || spec.gender === "neutre") && !spec.beard && (
        <g fill="#fb7185" opacity="0.32">
          <circle cx="24.2" cy="35" r="2.2" />
          <circle cx="39.8" cy="35" r="2.2" />
        </g>
      )}
      {spec.glasses && (
        <g fill="none" stroke={INK} strokeWidth="1.6">
          <circle cx="27" cy="30.5" r="4.4" />
          <circle cx="37" cy="30.5" r="4.4" />
          <path d="M31.4 30.3 h1.2 M22.6 29.8 l-3 -1 M41.4 29.8 l3 -1" />
        </g>
      )}
    </>
  );
}

export const AvatarSvg = memo(function AvatarSvg({
  spec,
  color,
  size = 32,
  ring,
}: {
  spec: AvatarSpec;
  color: string;
  size?: number;
  ring?: boolean;
}) {
  const small = size < 26;
  // Style DiceBear : rendu SVG local, posé sur un disque à la couleur du persona.
  if (spec.style && spec.style !== "classic") {
    return (
      <span
        className="inline-block shrink-0 overflow-hidden rounded-full"
        style={{ width: size, height: size, background: color, ...(ring ? { boxShadow: `0 0 0 2px var(--color-panel), 0 0 0 3.5px ${color}` } : {}) }}
        aria-hidden
      >
        <img src={diceUri(spec.style, spec.seed ?? "nadendar", spec.opts)} width={size} height={size} alt="" draggable={false} className="block h-full w-full" />
      </span>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="shrink-0 rounded-full"
      style={ring ? { boxShadow: `0 0 0 2px var(--color-panel), 0 0 0 3.5px ${color}` } : undefined}
      aria-hidden
    >
      <defs>
        <clipPath id="av-clip">
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath="url(#av-clip)">
        <rect width="64" height="64" fill={color} />
        <HairBack spec={spec} />
        <Face spec={spec} small={small} />
        <HairFront spec={spec} />
      </g>
    </svg>
  );
});

export function Avatar({ persona, size = 32, ring }: { persona: Pick<Persona, "avatar" | "color">; size?: number; ring?: boolean }) {
  return <AvatarSvg spec={persona.avatar} color={persona.color} size={size} ring={ring} />;
}
