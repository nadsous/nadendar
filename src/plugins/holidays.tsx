import { Flag } from "lucide-react";
import { holidayOn } from "../lib/holidays";
import type { Plugin } from "./types";

export const holidaysPlugin: Plugin = {
  id: "holidays",
  name: "Jours fériés",
  tagline: "Fériés français calculés automatiquement (Pâques, Ascension, Pentecôte…).",
  icon: Flag,
  color: "#f43f5e",
  category: "temps",
  defaultOn: true,
  links: ["workplan"],
  badges: (day) => {
    const h = holidayOn(day);
    if (!h) return [];
    return [
      {
        id: "holiday",
        order: 0,
        wide: true,
        title: `Jour férié : ${h}`,
        node: <span className="truncate rounded px-1 text-[10px] font-medium bg-rose-500/15 text-rose-300">{h}</span>,
      },
    ];
  },
};
