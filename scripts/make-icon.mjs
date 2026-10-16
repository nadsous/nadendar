// Icône Nadendar : la marque nads.site (apps/web/app/icon.svg) intacte, en orange,
// posée sur une page de calendrier dont les jours sont de petits carrés « pixels ».
// Toute la géométrie est en angles droits, comme la marque. Lancer depuis la racine :
//
//   node scripts/make-icon.mjs
//
// Écrit src-tauri/icons/app-icon.svg (source de `tauri icon`), public/icon.svg et
// src/assets/logo.svg (utilisé dans l'interface).

import { mkdirSync, writeFileSync } from "node:fs";

const BRAND = "#fe7146";
const BASE = "#111113";
const PAGE = "#1b1b1e";
const DOT = "#3a3a42";
const DOT_SOFT = "#2c2c33";

// Marque nads.site, dans son espace de 700 unités (x 170.5–829.5, y 275–725).
const MARK = [
  [170.5, 275], [341.3, 275], [341.3, 425], [424.1, 425], [424.1, 339.7], [574.3, 339.7],
  [574.3, 425], [658.7, 425], [658.7, 275], [829.5, 275], [829.5, 360.3], [744.1, 360.3],
  [744.1, 639.7], [829.5, 639.7], [829.5, 725], [658.7, 725], [658.7, 575], [574.3, 575],
  [574.3, 425], [424.1, 425], [424.1, 575], [341.3, 575], [341.3, 725], [170.5, 725],
  [170.5, 639.7], [255.9, 639.7], [255.9, 360.3], [170.5, 360.3],
];

const r = (n) => Math.round(n * 10) / 10;

function markPath(cx, cy, width) {
  const k = width / (829.5 - 170.5);
  const mx = (170.5 + 829.5) / 2;
  const my = (275 + 725) / 2;
  return (
    "M" +
    MARK.map(([x, y]) => `${r(cx + (x - mx) * k)} ${r(cy + (y - my) * k)}`).join("L") +
    "Z"
  );
}

function icon({ tile = true } = {}) {
  const parts = [];
  if (tile) parts.push(`<rect width="1024" height="1024" rx="224" fill="${BASE}"/>`);

  // Page du calendrier.
  const px = 120, py = 196, pw = 784, ph = 700;
  parts.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="72" fill="${PAGE}"/>`);
  // Bandeau du mois, orange, coins du haut arrondis.
  parts.push(
    `<path d="M${px} ${py + 72}a72 72 0 0 1 72-72h${pw - 144}a72 72 0 0 1 72 72v58H${px}Z" fill="${BRAND}"/>`,
  );
  // Anneaux de reliure en carrés pixel.
  for (const x of [300, 692]) {
    parts.push(`<rect x="${x}" y="136" width="32" height="112" rx="6" fill="#c9c9d0"/>`);
  }

  // Grille 7 × 5 de jours en petits carrés.
  const cols = 7, rows = 5;
  const gx = px + 58, gy = py + 172, gw = pw - 116, gh = ph - 224;
  const sx = gw / cols, sy = gh / rows;
  const s = 30;
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      const x = gx + c * sx + (sx - s) / 2;
      const y = gy + row * sy + (sy - s) / 2;
      const weekend = c >= 5;
      parts.push(
        `<rect x="${r(x)}" y="${r(y)}" width="${s}" height="${s}" rx="5" fill="${weekend ? DOT_SOFT : DOT}"/>`,
      );
    }
  }
  // Un jour « aujourd'hui » en orange, en bas à droite.
  {
    const x = gx + 6 * sx + (sx - s) / 2;
    const y = gy + 4 * sy + (sy - s) / 2;
    parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${s}" height="${s}" rx="5" fill="${BRAND}"/>`);
  }

  // La marque, détourée de la couleur de la page pour respirer au-dessus des carrés.
  const d = markPath(512, gy + gh / 2, 480);
  parts.push(`<path d="${d}" fill="none" stroke="${PAGE}" stroke-width="34" stroke-linejoin="miter"/>`);
  parts.push(`<path d="${d}" fill="${BRAND}"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${parts.join("")}</svg>\n`;
}

for (const dir of ["src-tauri/icons", "public", "src/assets"]) mkdirSync(dir, { recursive: true });
writeFileSync("src-tauri/icons/app-icon.svg", icon());
writeFileSync("public/icon.svg", icon());
writeFileSync("src/assets/logo.svg", icon());
console.log("Icônes écrites.");
