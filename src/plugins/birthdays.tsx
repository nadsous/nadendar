import { Cake } from "lucide-react";
import { fromKey } from "../lib/dates";
import type { CalItem, Plugin } from "./types";

export const birthdaysPlugin: Plugin = {
  id: "birthdays",
  name: "Anniversaires",
  tagline: "Les anniversaires des personas reviennent chaque année, avec l'âge.",
  icon: Cake,
  color: "#ec4899",
  category: "famille",
  defaultOn: true,
  items: (from, to, s) => {
    const out: CalItem[] = [];
    for (const p of s.personas) {
      if (!p.birthday) continue;
      const b = fromKey(p.birthday);
      for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
        const d = new Date(y, b.getMonth(), b.getDate());
        if (d < from || d >= to) continue;
        const age = y - b.getFullYear();
        out.push({
          id: `bday-${p.id}-${y}`,
          title: `${p.name}${age > 0 ? ` · ${age} ans` : ""}`,
          start: d,
          end: d,
          allDay: true,
          color: "#ec4899",
          personaIds: [p.id],
          icon: Cake,
          source: "birthdays",
        });
      }
    }
    return out;
  },
};
