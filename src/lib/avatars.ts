// Avatars DiceBear (https://www.dicebear.com) : générés sur l'appareil, sans réseau.
// Chaque style décrit ses options dans un schéma ; on s'en sert pour construire
// automatiquement l'éditeur (une grille de vignettes par partie du visage, des couleurs…).
import { createAvatar, type Style } from "@dicebear/core";
import { adventurer, avataaars, bigSmile, lorelei, micah, notionists, openPeeps, personas } from "@dicebear/collection";
import type { AvatarSpec } from "./types";

export type AvatarStyleId =
  | "classic"
  | "notionists"
  | "lorelei"
  | "avataaars"
  | "openPeeps"
  | "adventurer"
  | "personas"
  | "micah"
  | "bigSmile";

interface StyleInfo {
  id: Exclude<AvatarStyleId, "classic">;
  label: string;
  style: Style<object>;
  /** Mention exigée par la licence du style (CC BY) ; vide si domaine public. */
  credit?: string;
}

export const DICE_STYLES: StyleInfo[] = [
  { id: "notionists", label: "Notion", style: notionists as Style<object> },
  { id: "lorelei", label: "Lorelei", style: lorelei as Style<object> },
  { id: "avataaars", label: "Avataaars", style: avataaars as Style<object> },
  { id: "openPeeps", label: "Open Peeps", style: openPeeps as Style<object> },
  { id: "adventurer", label: "Aventurier", style: adventurer as Style<object>, credit: "« Adventurer » de Lisa Wischofsky, CC BY 4.0" },
  { id: "personas", label: "Personas", style: personas as Style<object>, credit: "« Personas » de Draftbit, CC BY 4.0" },
  { id: "micah", label: "Micah", style: micah as Style<object>, credit: "« Avatar Illustration System » de Micah Lanier, CC BY 4.0" },
  { id: "bigSmile", label: "Grand sourire", style: bigSmile as Style<object>, credit: "« Big Smile » d'Ashley Seo, CC BY 4.0" },
];

export const styleInfo = (id?: string) => DICE_STYLES.find((s) => s.id === id);

/** Libellés français des parties ; ce qui manque garde son nom d'origine. */
const LABELS: Record<string, string> = {
  hair: "Cheveux",
  top: "Coiffure",
  head: "Coiffure",
  eyes: "Yeux",
  brows: "Sourcils",
  eyebrows: "Sourcils",
  lips: "Bouche",
  mouth: "Bouche",
  face: "Expression",
  nose: "Nez",
  glasses: "Lunettes",
  beard: "Barbe",
  facialHair: "Barbe",
  body: "Tenue",
  clothing: "Tenue",
  shirt: "Tenue",
  clothingGraphic: "Motif",
  bodyIcon: "Badge",
  gesture: "Geste",
  earrings: "Boucles d'oreilles",
  accessories: "Accessoires",
  hairAccessories: "Accessoire de cheveux",
  freckles: "Taches de rousseur",
  features: "Détails du visage",
  mask: "Masque",
  ears: "Oreilles",
  skinColor: "Peau",
  baseColor: "Peau",
  hairColor: "Cheveux",
  facialHairColor: "Barbe",
  clothesColor: "Tenue",
  clothingColor: "Tenue",
  shirtColor: "Tenue",
  accessoriesColor: "Accessoires",
  hatColor: "Chapeau",
  eyesColor: "Yeux",
  eyebrowsColor: "Sourcils",
  mouthColor: "Lèvres",
  noseColor: "Nez",
  glassesColor: "Lunettes",
  earringsColor: "Boucles d'oreilles",
  earringColor: "Boucles d'oreilles",
  eyeShadowColor: "Fard à paupières",
  frecklesColor: "Taches de rousseur",
  hairAccessoriesColor: "Accessoire de cheveux",
  headContrastColor: "Cheveux",
};

/** Ordre d'affichage : le visage d'abord, les accessoires ensuite. */
const ORDER = ["hair", "top", "head", "eyes", "brows", "eyebrows", "lips", "mouth", "face", "nose", "glasses", "beard", "facialHair", "earrings", "accessories", "hairAccessories", "freckles", "features", "mask", "ears", "body", "clothing", "shirt", "clothingGraphic", "bodyIcon", "gesture"];

export interface VariantPart {
  prop: string;
  label: string;
  options: string[];
  /** Propriété « …Probability » : permet le choix « aucun ». */
  probability?: string;
}

export interface ColorPart {
  prop: string;
  label: string;
  palette: string[];
}

interface SchemaProp {
  items?: { enum?: string[]; pattern?: string };
  default?: unknown;
}

const partsCache = new Map<string, { variants: VariantPart[]; colors: ColorPart[] }>();

export function partsOf(id: string): { variants: VariantPart[]; colors: ColorPart[] } {
  const hit = partsCache.get(id);
  if (hit) return hit;
  const info = styleInfo(id);
  if (!info) return { variants: [], colors: [] };
  const props = (info.style.schema?.properties ?? {}) as Record<string, SchemaProp>;
  const variants: VariantPart[] = [];
  const colors: ColorPart[] = [];
  for (const [prop, def] of Object.entries(props)) {
    const options = def.items?.enum;
    // « style » (avataaars : cadre rond ou non) ne concerne pas l'utilisateur.
    if (prop === "style") continue;
    if (options && options.length > 1) {
      variants.push({ prop, label: LABELS[prop] ?? prop, options, probability: props[`${prop}Probability`] ? `${prop}Probability` : undefined });
    } else if (/Color$/.test(prop) && prop !== "backgroundColor" && Array.isArray(def.default)) {
      colors.push({ prop, label: LABELS[prop] ?? prop, palette: def.default as string[] });
    }
  }
  const rank = (p: string) => (ORDER.indexOf(p) < 0 ? 99 : ORDER.indexOf(p));
  variants.sort((a, b) => rank(a.prop) - rank(b.prop));
  const result = { variants, colors };
  partsCache.set(id, result);
  return result;
}

export type AvatarOpts = Record<string, string | number>;

const uriCache = new Map<string, string>();

/** Rendu SVG (data URI) d'un avatar DiceBear, mis en cache. */
export function diceUri(id: string, seed: string, opts: AvatarOpts = {}): string {
  const key = `${id}|${seed}|${JSON.stringify(opts)}`;
  const hit = uriCache.get(key);
  if (hit) return hit;
  const info = styleInfo(id);
  if (!info) return "";
  // Les choix sont stockés en valeur simple ; DiceBear attend des listes.
  const options: Record<string, unknown> = { seed };
  for (const [k, v] of Object.entries(opts)) options[k] = typeof v === "number" ? v : [v];
  const uri = createAvatar(info.style, options).toDataUri();
  if (uriCache.size > 4000) uriCache.clear();
  uriCache.set(key, uri);
  return uri;
}

/** Préréglages selon le genre : sans barbe pour « femme », barbe possible pour « homme ». */
export function genderOpts(id: string, gender: AvatarSpec["gender"], opts: AvatarOpts): AvatarOpts {
  const next = { ...opts };
  const beard = partsOf(id).variants.find((v) => ["beard", "facialHair"].includes(v.prop));
  if (beard?.probability) {
    if (gender === "femme") next[beard.probability] = 0;
    else if (gender === "homme" && next[beard.probability] === 0) delete next[beard.probability];
  }
  return next;
}

export const randomSeed = () => Math.random().toString(36).slice(2, 10);
