import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { uid } from "../lib/dates";
import type {
  CalEvent,
  Delivery,
  ID,
  Leave,
  Meal,
  Money,
  Persona,
  Project,
  Settings,
  ShoppingList,
  Todo,
  WorkPattern,
} from "../lib/types";
import type { SchoolHoliday } from "../lib/school";
import type { WeatherData } from "../lib/weather";

export interface Data {
  personas: Persona[];
  events: CalEvent[];
  patterns: WorkPattern[];
  leaves: Leave[];
  todos: Todo[];
  shopping: ShoppingList[];
  deliveries: Delivery[];
  meals: Meal[];
  money: Money[];
  projects: Project[];
}

export type Collection = keyof Data;
type Item<C extends Collection> = Data[C][number];

export interface Cache {
  weather: WeatherData | null;
  schoolHolidays: { zone: string; fetchedAt: number; list: SchoolHoliday[] } | null;
}

export interface UIState {
  cursor: number;
  selectedDay: string | null;
  editingEvent: Partial<CalEvent> | null;
  editingPersona: Partial<Persona> | null;
  modal: null | "plugins" | "settings" | "palette" | "print";
}

export interface AppState extends Data {
  settings: Settings;
  cache: Cache;
  ui: UIState;
  add: <C extends Collection>(c: C, item: Omit<Item<C>, "id"> & { id?: ID }) => ID;
  update: <C extends Collection>(c: C, id: ID, patch: Partial<Item<C>>) => void;
  remove: <C extends Collection>(c: C, id: ID) => void;
  setSettings: (p: Partial<Settings>) => void;
  setCache: (p: Partial<Cache>) => void;
  setUI: (p: Partial<UIState>) => void;
  togglePlugin: (id: string, on?: boolean) => void;
  replaceData: (d: Partial<Data>) => void;
}

export const EMPTY_DATA: Data = {
  personas: [],
  events: [],
  patterns: [],
  leaves: [],
  todos: [],
  shopping: [],
  deliveries: [],
  meals: [],
  money: [],
  projects: [],
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  place: null,
  schoolZone: "Zone C",
  plugins: {},
  view: "month",
  leftOpen: true,
  rightOpen: true,
  rightTab: "today",
  animations: true,
  compact: false,
  cellSize: "fit",
  notifications: true,
  onboarded: false,
};

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      ...EMPTY_DATA,
      settings: DEFAULT_SETTINGS,
      cache: { weather: null, schoolHolidays: null },
      ui: {
        cursor: Date.now(),
        selectedDay: null,
        editingEvent: null,
        editingPersona: null,
        modal: null,
      },
      add: (c, item) => {
        const id = item.id ?? uid();
        set((s) => ({ [c]: [...s[c], { ...item, id }] }) as Partial<AppState>);
        return id;
      },
      update: (c, id, patch) =>
        set(
          (s) =>
            ({
              [c]: (s[c] as { id: ID }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)),
            }) as Partial<AppState>,
        ),
      remove: (c, id) =>
        set(
          (s) => ({ [c]: (s[c] as { id: ID }[]).filter((x) => x.id !== id) }) as Partial<AppState>,
        ),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      setCache: (p) => set((s) => ({ cache: { ...s.cache, ...p } })),
      setUI: (p) => set((s) => ({ ui: { ...s.ui, ...p } })),
      togglePlugin: (id, on) =>
        set((s) => {
          const cur = s.settings.plugins[id];
          return { settings: { ...s.settings, plugins: { ...s.settings.plugins, [id]: on ?? !cur } } };
        }),
      replaceData: (d) => set(() => ({ ...EMPTY_DATA, ...d })),
    }),
    {
      name: "nadendar",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // L'état d'interface (curseur, modales) n'est pas sauvegardé.
      partialize: ({ ui: _ui, ...rest }) => rest,
    },
  ),
);

export const exportData = () => {
  const s = useApp.getState();
  const data: Data & { settings: Settings; version: number } = {
    version: 1,
    settings: s.settings,
    personas: s.personas,
    events: s.events,
    patterns: s.patterns,
    leaves: s.leaves,
    todos: s.todos,
    shopping: s.shopping,
    deliveries: s.deliveries,
    meals: s.meals,
    money: s.money,
    projects: s.projects,
  };
  return JSON.stringify(data, null, 2);
};

export const personaById = (id?: ID) =>
  id ? useApp.getState().personas.find((p) => p.id === id) : undefined;
