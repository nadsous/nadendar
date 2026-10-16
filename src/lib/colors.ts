// Encadrés pleins : fond à la couleur de l'élément, texte noir ou blanc selon le contraste.

/** Luminance relative WCAG d'une couleur #rrggbb. */
function luminance(hex: string): number {
  const h = hex.replace("#", "").slice(0, 6);
  if (h.length !== 6) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texte lisible sur ce fond : le choix qui donne le meilleur contraste. */
export function textOn(bg: string): string {
  const l = luminance(bg);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / 0.06;
  return onDark >= onWhite ? "#141416" : "#ffffff";
}

/** Style d'un encadré rempli. */
export const filled = (color: string) => ({ background: color, color: textOn(color) });
