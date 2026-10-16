// Modèle de données de Nadendar. Les dates « jour » sont des chaînes YYYY-MM-DD,
// les instants des chaînes ISO locales (YYYY-MM-DDTHH:mm).

export type ID = string;
export type DayKey = string;

// ── Personas ────────────────────────────────────────────────────────────────

export type Gender = "femme" | "homme" | "neutre";
export type HairStyle = "court" | "mi-long" | "long" | "chignon" | "boucle" | "queue" | "chauve";

export interface AvatarSpec {
  gender: Gender;
  hair: HairStyle;
  glasses: boolean;
  beard: boolean;
  /** Teinte de peau, index dans SKINS (style classique). */
  skin: number;
  /** Style DiceBear (« notionists »…) ; absent = avatar classique de Nadendar. */
  style?: string;
  /** Graine du tirage DiceBear : les parties non choisies en dépendent. */
  seed?: string;
  /** Parties choisies à la main (cheveux, yeux, couleurs…). */
  opts?: Record<string, string | number>;
}

export type PersonaRole = "adulte" | "ado" | "enfant" | "bebe" | "senior" | "autre";

export interface CycleSettings {
  enabled: boolean;
  /** Début des dernières règles connues. */
  lastStart: DayKey;
  cycleLength: number;
  periodLength: number;
  /** Débuts de règles notés, pour affiner la moyenne. */
  logs: DayKey[];
  /** Masque les détails (affiche seulement un point discret). */
  discreet: boolean;
}

export interface SchoolSlot {
  id: ID;
  /** 1 = lundi … 7 = dimanche. */
  weekday: number;
  start: string;
  end: string;
  subject: string;
  color: string;
}

export interface SchoolSettings {
  enabled: boolean;
  level: string;
  establishment: string;
  timetable: SchoolSlot[];
  /** Les vacances scolaires masquent l'emploi du temps. */
  followHolidays: boolean;
}

export interface Persona {
  id: ID;
  name: string;
  role: PersonaRole;
  color: string;
  avatar: AvatarSpec;
  birthday?: DayKey;
  job?: string;
  /** Taux horaire net, pour estimer le salaire depuis le planning. */
  hourlyRate?: number;
  cycle?: CycleSettings;
  school?: SchoolSettings;
  hidden?: boolean;
}

// ── Planning de travail ────────────────────────────────────────────────────

export type ShiftIcon =
  | "morning"
  | "afternoon"
  | "night"
  | "day"
  | "evening"
  | "remote"
  | "rest";

export interface ShiftType {
  code: string;
  label: string;
  icon: ShiftIcon;
  start: string;
  end: string;
  color: string;
  /** Jour non travaillé (repos). */
  off?: boolean;
}

export interface WorkPattern {
  id: ID;
  personaId: ID;
  name: string;
  /** Jour où le cycle commence (index 0 du rythme). */
  anchor: DayKey;
  /** Un code de poste par jour, répété en boucle. */
  cycle: string[];
  /** Les jours fériés deviennent des repos. */
  skipHolidays: boolean;
  from: DayKey;
  to?: DayKey;
}

export type LeaveType = "CP" | "RTT" | "maladie" | "formation" | "sans-solde" | "recup";

export interface Leave {
  id: ID;
  personaId: ID;
  type: LeaveType;
  start: DayKey;
  end: DayKey;
  note?: string;
}

// ── Événements ──────────────────────────────────────────────────────────────

export type MeetingProvider =
  | "meet"
  | "teams"
  | "zoom"
  | "doctolib"
  | "whatsapp"
  | "telephone"
  | "presentiel"
  | "autre";

export interface Recurrence {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  /** Pour weekly : 1 = lundi … 7 = dimanche. */
  byWeekday?: number[];
  until?: DayKey;
  exdates?: DayKey[];
}

export interface MailLink {
  subject: string;
  from?: string;
  url?: string;
  date?: string;
  snippet?: string;
}

export type EventKind = "event" | "meeting" | "appointment" | "reminder" | "birthday";

export interface CalEvent {
  id: ID;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  kind: EventKind;
  color?: string;
  personaIds: ID[];
  location?: string;
  notes?: string;
  meeting?: { provider: MeetingProvider; url?: string; phone?: string };
  mail?: MailLink;
  recurrence?: Recurrence;
  reminderMin?: number;
  /** Importé d'un agenda externe (Google, Outlook, iCloud…). */
  source?: { calId: ID; uid: string };
}

// ── Agendas externes (.ics) ─────────────────────────────────────────────────

export interface ExternalCalendar {
  id: ID;
  name: string;
  color: string;
  /** Fichier importé une fois, ou lien iCal resynchronisé régulièrement. */
  kind: "file" | "url";
  url?: string;
  personaId?: ID;
  lastSync?: string;
  count: number;
  error?: string;
}

// ── Maison ──────────────────────────────────────────────────────────────────

export interface Todo {
  id: ID;
  title: string;
  done: boolean;
  due?: DayKey;
  personaId?: ID;
  priority: 0 | 1 | 2 | 3;
  createdAt: string;
}

export interface ShopItem {
  id: ID;
  name: string;
  qty: string;
  done: boolean;
  category?: string;
}

export interface ShoppingList {
  id: ID;
  name: string;
  kind: "courses" | "fournitures" | "autre";
  date?: DayKey;
  personaId?: ID;
  items: ShopItem[];
}

export type DeliveryStatus = "attendue" | "en-route" | "livree" | "probleme";

export interface Delivery {
  id: ID;
  title: string;
  carrier: string;
  tracking?: string;
  date: DayKey;
  slotStart: string;
  slotEnd: string;
  personaId?: ID;
  status: DeliveryStatus;
  relay?: string;
}

export interface Meal {
  id: ID;
  date: DayKey;
  slot: "midi" | "soir";
  name: string;
  ingredients: string[];
}

// ── Finances ────────────────────────────────────────────────────────────────

export interface Money {
  id: ID;
  label: string;
  amount: number;
  type: "revenu" | "depense";
  category: string;
  date: DayKey;
  repeat?: "mensuel" | "hebdo" | "annuel";
  personaId?: ID;
}

// ── Projets / Gantt ─────────────────────────────────────────────────────────

export interface GanttTask {
  id: ID;
  name: string;
  start: DayKey;
  end: DayKey;
  progress: number;
  personaId?: ID;
  dependsOn: ID[];
}

export interface Project {
  id: ID;
  name: string;
  color: string;
  tasks: GanttTask[];
  showInCalendar: boolean;
}

// ── Réglages ────────────────────────────────────────────────────────────────

export interface GeoPlace {
  name: string;
  lat: number;
  lon: number;
  country?: string;
}

export type SchoolZone = "Zone A" | "Zone B" | "Zone C" | "Corse";
export type ViewId = "month" | "week" | "day" | "agenda" | string;
export type ThemeMode = "dark" | "light" | "system";
/** Taille des cases du mois : « fit » agrandit chaque semaine pour tout afficher. */
export type CellSize = "compact" | "normal" | "large" | "fit";

export interface Settings {
  theme: ThemeMode;
  place: GeoPlace | null;
  schoolZone: SchoolZone;
  plugins: Record<string, boolean>;
  view: ViewId;
  leftOpen: boolean;
  rightOpen: boolean;
  rightTab: string;
  animations: boolean;
  compact: boolean;
  cellSize: CellSize;
  notifications: boolean;
  onboarded: boolean;
  /** Catégories masquées à l'impression / en PDF. */
  printHidden?: string[];
}
