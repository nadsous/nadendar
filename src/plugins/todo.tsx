import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { CheckSquare, Circle, CircleCheck, Flag, Trash2 } from "lucide-react";
import { useState } from "react";
import { dayKey, fmt, fromKey, uid } from "../lib/dates";
import type { Todo } from "../lib/types";
import { useApp } from "../store/store";
import { Avatar } from "../components/ui/Avatar";
import { Empty } from "../components/ui/ui";
import type { CalItem, Plugin } from "./types";

const PRIO = ["#5b5b64", "#38bdf8", "#fbbf24", "#f87171"];

export function TodoRow({ t }: { t: Todo }) {
  const update = useApp((s) => s.update);
  const remove = useApp((s) => s.remove);
  const persona = useApp((s) => s.personas.find((p) => p.id === t.personaId));
  const late = !t.done && t.due && t.due < dayKey(new Date());
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-elev"
    >
      <button onClick={() => update("todos", t.id, { done: !t.done })} className="cursor-pointer" aria-label="Cocher">
        {t.done ? <CircleCheck size={17} className="text-ok" /> : <Circle size={17} style={{ color: PRIO[t.priority] }} />}
      </button>
      <span className={clsx("flex-1 truncate text-[13px]", t.done ? "text-faint line-through" : "text-bright")}>{t.title}</span>
      {t.due && <span className={clsx("text-[11px] tabular", late ? "text-bad" : "text-muted")}>{fmt(fromKey(t.due), "d MMM")}</span>}
      {persona && <Avatar persona={persona} size={18} />}
      <button
        onClick={() => update("todos", t.id, { priority: ((t.priority + 1) % 4) as Todo["priority"] })}
        className="opacity-0 group-hover:opacity-100 cursor-pointer"
        aria-label="Priorité"
      >
        <Flag size={13} style={{ color: PRIO[t.priority] }} />
      </button>
      <button onClick={() => remove("todos", t.id)} className="text-faint opacity-0 hover:text-bad group-hover:opacity-100 cursor-pointer" aria-label="Supprimer">
        <Trash2 size={13} />
      </button>
    </motion.div>
  );
}

/** Saisie rapide : « Appeler la mairie demain @Léa !! » */
export function parseQuick(text: string, personas: { id: string; name: string }[]) {
  let title = text;
  let due: string | undefined;
  let personaId: string | undefined;
  const now = new Date();
  const low = title.toLowerCase();
  if (/\baujourd'hui\b/.test(low)) {
    due = dayKey(now);
    title = title.replace(/\baujourd'hui\b/i, "");
  } else if (/\bdemain\b/.test(low)) {
    due = dayKey(new Date(now.getTime() + 86400000));
    title = title.replace(/\bdemain\b/i, "");
  }
  const at = title.match(/@(\S+)/);
  if (at) {
    const p = personas.find((x) => x.name.toLowerCase().startsWith(at[1].toLowerCase()));
    if (p) personaId = p.id;
    title = title.replace(at[0], "");
  }
  const bangs = title.match(/!+/)?.[0].length ?? 0;
  title = title.replace(/!+/g, "").replace(/\s+/g, " ").trim();
  return { title, due, personaId, priority: Math.min(3, bangs) as Todo["priority"] };
}

function Panel() {
  const todos = useApp((s) => s.todos);
  const personas = useApp((s) => s.personas);
  const add = useApp((s) => s.add);
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const open = todos.filter((t) => !t.done).sort((a, b) => b.priority - a.priority || (a.due ?? "9").localeCompare(b.due ?? "9"));
  const done = todos.filter((t) => t.done);
  return (
    <div className="grid gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          add("todos", { id: uid(), done: false, createdAt: new Date().toISOString(), ...parseQuick(text, personas) });
          setText("");
        }}
      >
        <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter… (demain, @prénom, !!)" />
      </form>
      {!open.length && <Empty icon={CheckSquare} text="Rien à faire. Profites-en !" />}
      <div className="grid">
        <AnimatePresence initial={false}>
          {open.map((t) => (
            <TodoRow key={t.id} t={t} />
          ))}
        </AnimatePresence>
      </div>
      {done.length > 0 && (
        <button className="text-left text-[12px] text-muted hover:text-fg cursor-pointer" onClick={() => setShowDone(!showDone)}>
          {showDone ? "Masquer" : "Afficher"} les {done.length} tâches faites
        </button>
      )}
      {showDone && (
        <div className="grid">
          <AnimatePresence initial={false}>
            {done.map((t) => (
              <TodoRow key={t.id} t={t} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export const todoPlugin: Plugin = {
  id: "todo",
  name: "To-do list",
  tagline: "Tâches avec échéance, priorité et responsable, visibles dans le calendrier.",
  icon: CheckSquare,
  color: "#a3e635",
  category: "productivite",
  defaultOn: true,
  links: ["mail", "gantt"],
  items: (from, to, s) => {
    const a = dayKey(from);
    const b = dayKey(to);
    return s.todos
      .filter((t) => t.due && !t.done && t.due >= a && t.due < b)
      .map<CalItem>((t) => ({
        id: `todo-${t.id}`,
        title: t.title,
        start: fromKey(t.due!),
        end: fromKey(t.due!),
        allDay: true,
        color: PRIO[t.priority] === PRIO[0] ? "#a3e635" : PRIO[t.priority],
        personaIds: t.personaId ? [t.personaId] : [],
        icon: CheckSquare,
        source: "todo",
      }));
  },
  panel: { label: "To-do", component: Panel },
};
