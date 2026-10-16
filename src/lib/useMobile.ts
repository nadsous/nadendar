import { useEffect, useState } from "react";

/** Largeur sous laquelle l'interface passe en disposition téléphone. */
export const MOBILE_BREAKPOINT = 820;

export const isMobileWidth = () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

export function useMobile() {
  const [m, setM] = useState(isMobileWidth);
  useEffect(() => {
    const h = () => setM(isMobileWidth());
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

/** En dessous, le panneau de droite (330 px) s'ouvre en tiroir au lieu de serrer le calendrier. */
export const RIGHT_INLINE = 1280;
/** En dessous, le panneau de gauche (268 px) s'ouvre en tiroir. */
export const LEFT_INLINE = 1040;

export const canInline = (side: "left" | "right") =>
  typeof window !== "undefined" && window.innerWidth >= (side === "left" ? LEFT_INLINE : RIGHT_INLINE);

export function useWidth() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

/** Nombre de jours de la vue « semaine » : 3 sur téléphone, 7 sinon. */
export const weekSpan = () => (isMobileWidth() ? 3 : 7);

/** Premier jour affiché par la vue « semaine » : le lundi sur PC, le jour courant sur téléphone. */
export function weekStart(cursor: number): Date {
  const d = new Date(cursor);
  d.setHours(0, 0, 0, 0);
  if (isMobileWidth()) return d;
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
