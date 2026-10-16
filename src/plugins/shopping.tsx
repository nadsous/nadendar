import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Backpack, Check, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import { dayKey, fmt, fromKey, uid } from "../lib/dates";
import type { ShoppingList } from "../lib/types";
import { useApp } from "../store/store";
import { Avatar } from "../components/ui/Avatar";
import { Button, Empty, PersonaSelect } from "../components/ui/ui";
import type { CalItem, Plugin } from "./types";

/** Rayon deviné pour trier la liste comme dans le magasin. */
const AISLES: [string, RegExp][] = [
  ["Fruits & légumes", /pomme|banane|tomate|salade|carotte|oignon|ail|fruit|légume|citron|courgette|poivron|patate|pomme de terre/i],
  ["Frais", /lait|yaourt|fromage|beurre|crème|oeuf|œuf|jambon/i],
  ["Boucherie", /poulet|boeuf|bœuf|viande|steak|poisson|saumon|dinde/i],
  ["Épicerie", /pâtes|riz|farine|sucre|huile|café|thé|céréale|conserve|sel|chocolat/i],
  ["Boissons", /eau|jus|soda|bière|vin/i],
  ["Maison", /lessive|papier|savon|éponge|liquide|sac|shampo/i],
  ["Fournitures", /cahier|stylo|crayon|classeur|trousse|colle|ciseau|règle|gomme|feutre|cartable|agenda|copie/i],
];
const aisleOf = (name: string) => AISLES.find(([, r]) => r.test(name))?.[0] ?? "Divers";

function ListCard({ list }: { list: ShoppingList }) {
  const update = useApp((s) => s.update);
  const remove = useApp((s) => s.remove);
  const persona = useApp((s) => s.personas.find((p) => p.id === list.personaId));
  const [text, setText] = useState("");
  const [open, setOpen] = useState(true);
  const left = list.items.filter((i) => !i.done).length;
  const groups = new Map<string, typeof list.items>();
  for (const it of [...list.items].sort((a, b) => Number(a.done) - Number(b.done))) {
    const g = it.category ?? aisleOf(it.name);
    groups.set(g, [...(groups.get(g) ?? []), it]);
  }
  const setItems = (items: ShoppingList["items"]) => update("shopping", list.id, { items });
  const Icon = list.kind === "fournitures" ? Backpack : ShoppingCart;

  return (
    <div className="rounded-xl border border-line bg-base/50">
      <button className="flex w-full items-center gap-2 px-2.5 py-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <Icon size={15} className={list.kind === "fournitures" ? "text-emerald-400" : "text-brand"} />
        <span className="flex-1 truncate text-left text-[13px] font-medium text-bright">{list.name}</span>
        {list.date && <span className="text-[11px] text-muted">{fmt(fromKey(list.date), "EEE d")}</span>}
        {persona && <Avatar persona={persona} size={18} />}
        <span className={clsx("rounded-md px-1.5 text-[11px] tabular", left ? "bg-elev text-fg" : "bg-ok/15 text-ok")}>{left || <Check size={11} />}</span>
      </button>
      {open && (
        <div className="grid gap-1.5 border-t border-line px-2.5 pb-2.5 pt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const names = text.split(/,|\n/).map((x) => x.trim()).filter(Boolean);
              if (!names.length) return;
              setItems([
                ...list.items,
                ...names.map((n) => {
                  const q = n.match(/^(\d+\s*\w{0,3})\s+(.+)/);
                  return { id: uid(), name: q ? q[2] : n, qty: q ? q[1] : "", done: false };
                }),
              ]);
              setText("");
            }}
          >
            <input className="field !h-8 text-[12.5px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="2 kg pommes, lait, cahier 24×32…" />
          </form>
          {[...groups].map(([g, items]) => (
            <div key={g}>
              <div className="px-1 text-[10.5px] font-semibold uppercase tracking-wider text-faint">{g}</div>
              <AnimatePresence initial={false}>
                {items.map((it) => (
                  <motion.div layout key={it.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-elev">
                    <input type="checkbox" checked={it.done} onChange={() => setItems(list.items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))} />
                    <span className={clsx("flex-1 text-[12.5px]", it.done ? "text-faint line-through" : "text-fg")}>{it.name}</span>
                    {it.qty && <span className="text-[11px] text-muted">{it.qty}</span>}
                    <button className="text-faint opacity-0 hover:text-bad group-hover:opacity-100 cursor-pointer" onClick={() => setItems(list.items.filter((x) => x.id !== it.id))} aria-label="Retirer">
                      <Trash2 size={12} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))}
          <div className="mt-1 grid grid-cols-[1fr_1fr_auto] gap-1.5">
            <input type="date" className="field !h-8 text-[12px]" value={list.date ?? ""} onChange={(e) => update("shopping", list.id, { date: e.target.value || undefined })} />
            <PersonaSelect value={list.personaId} onChange={(personaId) => update("shopping", list.id, { personaId })} placeholder="Qui y va ?" />
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setItems(list.items.filter((i) => !i.done))} title="Retirer les articles cochés">
                <Check size={13} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove("shopping", list.id)} title="Supprimer la liste">
                <Trash2 size={13} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel() {
  const lists = useApp((s) => s.shopping);
  const add = useApp((s) => s.add);
  const create = (kind: ShoppingList["kind"]) =>
    add("shopping", {
      id: uid(),
      name: kind === "fournitures" ? "Fournitures scolaires" : "Courses",
      kind,
      items: [],
      date: dayKey(new Date()),
    });
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" icon={Plus} onClick={() => create("courses")}>
          Courses
        </Button>
        <Button size="sm" icon={Plus} onClick={() => create("fournitures")}>
          Fournitures
        </Button>
      </div>
      {!lists.length && <Empty icon={ShoppingCart} text="Aucune liste. Les menus de la semaine peuvent la remplir pour toi." />}
      {lists.map((l) => (
        <ListCard key={l.id} list={l} />
      ))}
    </div>
  );
}

export const shoppingPlugin: Plugin = {
  id: "shopping",
  name: "Courses & fournitures",
  tagline: "Listes triées par rayon, jour de courses et personne qui s'en charge.",
  icon: ShoppingCart,
  color: "#fe7146",
  category: "maison",
  defaultOn: true,
  links: ["meals", "school", "budget"],
  items: (from, to, s) => {
    const a = dayKey(from);
    const b = dayKey(to);
    return s.shopping
      .filter((l) => l.date && l.date >= a && l.date < b && l.items.some((i) => !i.done))
      .map<CalItem>((l) => ({
        id: `shop-${l.id}`,
        title: `${l.name} (${l.items.filter((i) => !i.done).length})`,
        start: fromKey(l.date!),
        end: fromKey(l.date!),
        allDay: true,
        color: l.kind === "fournitures" ? "#34d399" : "#fe7146",
        personaIds: l.personaId ? [l.personaId] : [],
        icon: l.kind === "fournitures" ? Backpack : ShoppingCart,
        source: "shopping",
      }));
  },
  panel: { label: "Courses", component: Panel },
};
