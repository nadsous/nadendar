import { addDays, isSameDay, startOfWeek } from "date-fns";
import { ChefHat, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { cap, dayKey, fmt, uid, WEEK } from "../lib/dates";
import type { Meal } from "../lib/types";
import { useApp } from "../store/store";
import { Button } from "../components/ui/ui";
import type { Plugin } from "./types";

function MealCell({ date, slot }: { date: Date; slot: Meal["slot"] }) {
  const k = dayKey(date);
  const meal = useApp((s) => s.meals.find((m) => m.date === k && m.slot === slot));
  const { add, update, remove } = useApp.getState();
  const [v, setV] = useState(meal ? [meal.name, ...meal.ingredients].join(", ") : "");
  const commit = () => {
    const [name, ...ingredients] = v.split(",").map((x) => x.trim()).filter(Boolean);
    if (!name) {
      if (meal) remove("meals", meal.id);
      return;
    }
    if (meal) update("meals", meal.id, { name, ingredients });
    else add("meals", { id: uid(), date: k, slot, name, ingredients });
  };
  return (
    <input
      className="w-full min-w-0 rounded-md bg-transparent px-1.5 py-1 text-[12px] text-fg outline-none placeholder:text-faint focus:bg-base"
      value={v}
      placeholder={slot === "midi" ? "Midi" : "Soir"}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      title="Plat, puis ingrédients séparés par des virgules"
    />
  );
}

function Panel() {
  const cursor = useApp((s) => s.ui.cursor);
  const meals = useApp((s) => s.meals);
  const { add } = useApp.getState();
  const monday = startOfWeek(new Date(cursor), WEEK);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [done, setDone] = useState(false);

  const toShopping = () => {
    const keys = new Set(days.map(dayKey));
    const ingredients = [...new Set(meals.filter((m) => keys.has(m.date)).flatMap((m) => m.ingredients))];
    if (!ingredients.length) return;
    add("shopping", {
      id: uid(),
      name: `Courses semaine du ${fmt(monday, "d MMM")}`,
      kind: "courses",
      date: dayKey(addDays(monday, -1)),
      items: ingredients.map((name) => ({ id: uid(), name, qty: "", done: false })),
    });
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };

  return (
    <div className="grid gap-2">
      <p className="text-[11.5px] text-faint">« Plat, ingrédient, ingrédient… » — les ingrédients partent dans la liste de courses.</p>
      <div className="grid gap-1">
        {days.map((d) => (
          <div key={d.getTime()} className={`grid grid-cols-[46px_1fr_1fr] items-center gap-1 rounded-lg px-1 ${isSameDay(d, new Date()) ? "bg-sel" : "bg-base/50"}`}>
            <span className="text-[11.5px] text-muted">{cap(fmt(d, "EEE d"))}</span>
            <MealCell key={dayKey(d) + "m"} date={d} slot="midi" />
            <MealCell key={dayKey(d) + "s"} date={d} slot="soir" />
          </div>
        ))}
      </div>
      <Button icon={ShoppingCart} onClick={toShopping}>
        {done ? "Ajouté aux courses ✓" : "Envoyer les ingrédients aux courses"}
      </Button>
    </div>
  );
}

export const mealsPlugin: Plugin = {
  id: "meals",
  name: "Menus de la semaine",
  tagline: "Planifier midi et soir ; les ingrédients remplissent la liste de courses.",
  icon: ChefHat,
  color: "#f59e0b",
  category: "maison",
  defaultOn: false,
  links: ["shopping"],
  badges: (day, s) => {
    const k = dayKey(day);
    const m = s.meals.filter((x) => x.date === k);
    if (!m.length) return [];
    return [{ id: "meal", order: 6, title: m.map((x) => `${x.slot} : ${x.name}`).join(" · "), node: <ChefHat size={12} className="text-amber-400" /> }];
  },
  panel: { label: "Menus", component: Panel },
};
