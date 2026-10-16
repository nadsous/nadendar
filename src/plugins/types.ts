import type { LucideIcon } from "lucide-react";
import type { FC, ReactNode } from "react";
import type { CalEvent, Persona } from "../lib/types";
import type { AppState } from "../store/store";

/** Un élément placé dans le calendrier (événement, poste, cours, livraison…). */
export interface CalItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string;
  personaIds: string[];
  icon?: LucideIcon;
  source: string;
  /** Événement d'origine, s'il est modifiable. */
  event?: CalEvent;
  /** Affiché en fond (cours, postes) plutôt qu'en bloc plein. */
  subtle?: boolean;
  /** Petite mention à droite (ex. « 14:00 », « Colissimo »). */
  meta?: string;
  /** Avertissement (ex. personne indisponible). */
  warning?: string;
}

/** Petite icône dans l'en-tête d'un jour (météo, lune, férié, budget…). */
export interface DayBadge {
  id: string;
  node: ReactNode;
  title: string;
  /** Plus petit = plus à gauche. */
  order: number;
  /** Texte au lieu d'une icône seule (ex. nom du férié). */
  wide?: boolean;
  /** Durée d'affichage (ms) : les badges qui en ont une se partagent une même place, à tour de rôle. */
  cycle?: number;
}

/** Pastille persona + icône (postes de travail, congés, cycle…). */
export interface PersonaChip {
  id: string;
  personaId: string;
  icon: LucideIcon;
  label: string;
  color: string;
  order: number;
}

export type PluginCategory = "temps" | "famille" | "travail" | "maison" | "finances" | "productivite";

export const CATEGORIES: Record<PluginCategory, string> = {
  temps: "Temps & ciel",
  famille: "Famille",
  travail: "Travail",
  maison: "Maison",
  finances: "Finances",
  productivite: "Productivité",
};

export interface Plugin {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  color: string;
  category: PluginCategory;
  defaultOn: boolean;
  /** Plugins avec lesquels il échange des données (affiché dans la boutique). */
  links?: string[];
  items?: (from: Date, to: Date, s: AppState) => CalItem[];
  badges?: (day: Date, s: AppState) => DayBadge[];
  chips?: (day: Date, s: AppState) => PersonaChip[];
  /** Plages à griser dans les vues horaires (ex. nuit). */
  shade?: (day: Date, s: AppState) => { from: number; to: number; label: string }[];
  /** Onglet du panneau de droite. */
  panel?: { label: string; component: FC };
  /** Vue plein écran ajoutée au sélecteur de vues. */
  view?: { id: string; label: string; icon: LucideIcon; component: FC };
  /** Section dans la fiche d'un persona. */
  personaSection?: FC<{ persona: Persona; onChange: (p: Partial<Persona>) => void }>;
  /** Bloc dans le résumé d'une journée. */
  dayDetail?: FC<{ day: Date }>;
  /** Élément de la barre d'état. */
  status?: FC;
  /** Hook lancé au démarrage si le plugin est actif (chargement de données…). */
  useBoot?: () => void;
}
