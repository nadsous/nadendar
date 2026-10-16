import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CalendarPlus, CheckSquare, Printer, Puzzle, Search, Settings2, UserPlus, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cap, fmt, parseLocal } from "../../lib/dates";
import { useEnabledPlugins } from "../../plugins/registry";
import { showPanel, useApp } from "../../store/store";
import { newEventAt } from "../views/shared";
import { blankPersona } from "./PersonaEditor";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

export function CommandPalette() {
  const open = useApp((s) => s.ui.modal === "palette");
  const { events, personas, todos, setUI, setSettings } = useApp();
  const plugins = useEnabledPlugins();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
    }
  }, [open]);

  const close = () => setUI({ modal: null });
  const cmds = useMemo<Cmd[]>(() => {
    const go = (view: string) => () => setSettings({ view });
    const base: Cmd[] = [
      { id: "new", label: "Nouvel événement", icon: CalendarPlus, run: () => newEventAt(new Date(Math.ceil(Date.now() / 3600000) * 3600000)) },
      { id: "persona", label: "Nouveau persona", icon: UserPlus, run: () => setUI({ editingPersona: blankPersona(personas.length) }) },
      { id: "today", label: "Aller à aujourd'hui", icon: CalendarDays, run: () => setUI({ cursor: Date.now() }) },
      { id: "month", label: "Vue mois", icon: CalendarDays, run: go("month") },
      { id: "week", label: "Vue semaine", icon: CalendarDays, run: go("week") },
      { id: "day", label: "Vue jour", icon: CalendarDays, run: go("day") },
      { id: "agenda", label: "Vue agenda", icon: CalendarDays, run: go("agenda") },
      ...plugins.filter((p) => p.view).map((p) => ({ id: `v-${p.id}`, label: `Vue ${p.view!.label}`, icon: p.view!.icon, run: go(p.view!.id) })),
      { id: "print", label: "Imprimer / exporter en PDF", icon: Printer, run: () => setUI({ modal: "print" }) },
      { id: "plugins", label: "Plugins", icon: Puzzle, run: () => setUI({ modal: "plugins" }) },
      { id: "settings", label: "Réglages", icon: Settings2, run: () => setUI({ modal: "settings" }) },
    ];
    if (!q.trim()) return base;
    const n = norm(q);
    const found: Cmd[] = [
      ...personas.filter((p) => norm(p.name).includes(n)).map((p) => ({ id: p.id, label: p.name, hint: "Persona", icon: UserRound, run: () => setUI({ editingPersona: p, modal: null }) })),
      ...events
        .filter((e) => norm(e.title).includes(n) || norm(e.notes ?? "").includes(n))
        .slice(0, 20)
        .map((e) => ({
          id: e.id,
          label: e.title,
          hint: cap(fmt(parseLocal(e.start), "EEE d MMM yyyy")),
          icon: CalendarDays,
          run: () => setUI({ editingEvent: e, cursor: parseLocal(e.start).getTime(), modal: null }),
        })),
      ...todos.filter((t) => norm(t.title).includes(n)).map((t) => ({ id: t.id, label: t.title, hint: "Tâche", icon: CheckSquare, run: () => showPanel("right", "todo") })),
    ];
    return [...found, ...base.filter((c) => norm(c.label).includes(n))];
  }, [q, events, personas, todos, plugins, setUI, setSettings]);

  const run = (c: Cmd) => {
    close();
    c.run();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex justify-center bg-black/50 pt-[12vh] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <motion.div className="panel h-fit w-full max-w-[560px] overflow-hidden shadow-2xl shadow-black/60 mx-3" initial={{ y: -12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -8, opacity: 0 }}>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search size={16} className="text-muted" />
              <input
                autoFocus
                className="h-12 flex-1 bg-transparent text-[15px] text-bright outline-none placeholder:text-faint"
                placeholder="Chercher un événement, un persona, une action…"
                value={q}
                onChange={(e) => (setQ(e.target.value), setIdx(0))}
                onKeyDown={(e) => {
                  if (e.key === "Escape") close();
                  if (e.key === "ArrowDown") (e.preventDefault(), setIdx((i) => Math.min(i + 1, cmds.length - 1)));
                  if (e.key === "ArrowUp") (e.preventDefault(), setIdx((i) => Math.max(i - 1, 0)));
                  if (e.key === "Enter" && cmds[idx]) run(cmds[idx]);
                }}
              />
              <kbd className="rounded bg-elev px-1.5 text-[11px] text-muted">Échap</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-1.5">
              {cmds.map((c, i) => (
                <button key={c.id} onMouseEnter={() => setIdx(i)} onClick={() => run(c)} className={clsx("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] cursor-pointer", i === idx ? "bg-sel text-bright" : "text-fg")}>
                  <c.icon size={15} className={i === idx ? "text-brand" : "text-muted"} />
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="text-[12px] text-faint">{c.hint}</span>}
                </button>
              ))}
              {!cmds.length && <div className="p-6 text-center text-[13px] text-faint">Aucun résultat.</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
