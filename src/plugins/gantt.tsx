import clsx from "clsx";
import { addDays, differenceInCalendarDays, isWeekend, startOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { ChartGantt, Eye, EyeOff, Link2, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cap, dayKey, fmt, fromKey, uid } from "../lib/dates";
import type { GanttTask, Project } from "../lib/types";
import { useApp } from "../store/store";
import { Avatar } from "../components/ui/Avatar";
import { Button, Empty, PALETTE, PersonaSelect } from "../components/ui/ui";
import type { CalItem, Plugin } from "./types";

const DAY_W = 30;
const ROW_H = 38;
const SPAN = 75;

type Drag = { pid: string; tid: string; mode: "move" | "l" | "r"; x0: number; start: string; end: string };

function GanttView() {
  const projects = useApp((s) => s.projects);
  const personas = useApp((s) => s.personas);
  const cursor = useApp((s) => s.ui.cursor);
  const { add, update, remove } = useApp.getState();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<{ tid: string; start: string; end: string } | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const origin = addDays(startOfMonth(new Date(cursor)), -7);
  const days = Array.from({ length: SPAN }, (_, i) => addDays(origin, i));
  const x = (k: string) => differenceInCalendarDays(fromKey(k), origin) * DAY_W;
  const todayX = differenceInCalendarDays(new Date(), origin) * DAY_W;

  useEffect(() => {
    scroller.current?.scrollTo({ left: Math.max(0, todayX - 200), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const dd = Math.round((e.clientX - drag.x0) / DAY_W);
      const s = fromKey(drag.start);
      const en = fromKey(drag.end);
      let ns = s;
      let ne = en;
      if (drag.mode === "move") (ns = addDays(s, dd)), (ne = addDays(en, dd));
      if (drag.mode === "l") ns = addDays(s, Math.min(dd, differenceInCalendarDays(en, s)));
      if (drag.mode === "r") ne = addDays(en, Math.max(dd, -differenceInCalendarDays(en, s)));
      setPreview({ tid: drag.tid, start: dayKey(ns), end: dayKey(ne) });
    };
    const up = () => {
      setPreview((p) => {
        if (p) {
          const proj = useApp.getState().projects.find((x) => x.id === drag.pid);
          if (proj) update("projects", proj.id, { tasks: proj.tasks.map((t) => (t.id === p.tid ? { ...t, start: p.start, end: p.end } : t)) });
        }
        return null;
      });
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, update]);

  const newProject = () =>
    add("projects", {
      id: uid(),
      name: "Nouveau projet",
      color: PALETTE[(projects.length * 5) % PALETTE.length],
      showInCalendar: true,
      tasks: [{ id: uid(), name: "Première étape", start: dayKey(new Date()), end: dayKey(addDays(new Date(), 4)), progress: 0, dependsOn: [] }],
    });

  const setTask = (p: Project, tid: string, patch: Partial<GanttTask>) =>
    update("projects", p.id, { tasks: p.tasks.map((t) => (t.id === tid ? { ...t, ...patch } : t)) });

  if (!projects.length)
    return (
      <Empty icon={ChartGantt} text="Les projets (travaux, déménagement, mariage…) se planifient ici en diagramme de Gantt.">
        <Button variant="primary" icon={Plus} onClick={newProject}>
          Créer un projet
        </Button>
      </Empty>
    );

  // Lignes à plat : en-tête projet puis tâches.
  const rows: ({ kind: "p"; p: Project } | { kind: "t"; p: Project; t: GanttTask })[] = [];
  for (const p of projects) {
    rows.push({ kind: "p", p });
    for (const t of p.tasks) rows.push({ kind: "t", p, t });
  }
  const rowIndex = new Map(rows.map((r, i) => [r.kind === "t" ? r.t.id : r.p.id, i]));

  return (
    <div className="flex h-full overflow-hidden">
      {/* Colonne des noms */}
      <div className="w-[260px] shrink-0 border-r border-line overflow-y-auto" onScroll={(e) => scroller.current && (scroller.current.scrollTop = e.currentTarget.scrollTop)}>
        <div className="sticky top-0 z-10 flex h-[46px] items-center gap-2 border-b border-line bg-panel px-3">
          <span className="flex-1 text-[12px] font-medium text-muted">Projets & tâches</span>
          <Button size="sm" icon={Plus} onClick={newProject}>
            Projet
          </Button>
        </div>
        {rows.map((r) =>
          r.kind === "p" ? (
            <div key={r.p.id} className="group flex items-center gap-2 px-3" style={{ height: ROW_H }}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.p.color }} />
              <input className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-bright outline-none" value={r.p.name} onChange={(e) => update("projects", r.p.id, { name: e.target.value })} />
              <button className="text-faint hover:text-bright cursor-pointer" title="Afficher dans le calendrier" onClick={() => update("projects", r.p.id, { showInCalendar: !r.p.showInCalendar })}>
                {r.p.showInCalendar ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button
                className="text-faint hover:text-brand cursor-pointer"
                title="Ajouter une tâche"
                onClick={() => {
                  const last = r.p.tasks[r.p.tasks.length - 1];
                  const s = last ? addDays(fromKey(last.end), 1) : new Date();
                  update("projects", r.p.id, { tasks: [...r.p.tasks, { id: uid(), name: "Tâche", start: dayKey(s), end: dayKey(addDays(s, 2)), progress: 0, dependsOn: last ? [last.id] : [] }] });
                }}
              >
                <Plus size={14} />
              </button>
              <button className="text-faint opacity-0 hover:text-bad group-hover:opacity-100 cursor-pointer" onClick={() => remove("projects", r.p.id)} aria-label="Supprimer le projet">
                <Trash2 size={13} />
              </button>
            </div>
          ) : (
            <div key={r.t.id} className={clsx("group flex items-center gap-1.5 pl-7 pr-3", linking === r.t.id && "bg-sel")} style={{ height: ROW_H }}>
              <input className="min-w-0 flex-1 bg-transparent text-[12.5px] text-fg outline-none" value={r.t.name} onChange={(e) => setTask(r.p, r.t.id, { name: e.target.value })} />
              <div className="w-[70px] opacity-60 group-hover:opacity-100">
                <PersonaSelect value={r.t.personaId} onChange={(personaId) => setTask(r.p, r.t.id, { personaId })} placeholder="—" />
              </div>
              <button className={clsx("cursor-pointer", linking ? "text-brand" : "text-faint opacity-0 group-hover:opacity-100 hover:text-bright")} title="Lier : cliquer ici puis sur la tâche qui doit finir avant" onClick={() => setLinking(linking === r.t.id ? null : r.t.id)}>
                <Link2 size={13} />
              </button>
              <button className="text-faint opacity-0 hover:text-bad group-hover:opacity-100 cursor-pointer" onClick={() => update("projects", r.p.id, { tasks: r.p.tasks.filter((t) => t.id !== r.t.id) })} aria-label="Supprimer">
                <Trash2 size={12} />
              </button>
            </div>
          ),
        )}
      </div>

      {/* Frise */}
      <div ref={scroller} className="relative flex-1 overflow-auto">
        <div style={{ width: SPAN * DAY_W, minHeight: "100%" }} className="relative">
          <div className="sticky top-0 z-10 flex h-[46px] border-b border-line bg-panel">
            {days.map((d) => (
              <div key={d.getTime()} className={clsx("flex shrink-0 flex-col items-center justify-center text-[10px]", isWeekend(d) ? "text-faint" : "text-muted", d.getDate() === 1 && "border-l border-line2")} style={{ width: DAY_W }}>
                {d.getDate() === 1 || d.getTime() === origin.getTime() ? <span className="text-[10px] font-semibold text-brand">{cap(fmt(d, "MMM"))}</span> : <span className="uppercase">{fmt(d, "EEEEE")}</span>}
                <span className="tabular text-fg">{d.getDate()}</span>
              </div>
            ))}
          </div>
          {/* Week-ends */}
          {days.map((d, i) => isWeekend(d) && <div key={i} className="absolute bottom-0 top-[46px] bg-white/[0.018]" style={{ left: i * DAY_W, width: DAY_W }} />)}
          {/* Aujourd'hui */}
          {todayX >= 0 && todayX <= SPAN * DAY_W && <div className="absolute bottom-0 top-[46px] w-[2px] bg-brand/70" style={{ left: todayX + DAY_W / 2 }} />}

          <svg className="pointer-events-none absolute left-0 top-[46px]" width={SPAN * DAY_W} height={rows.length * ROW_H}>
            {rows.map((r) => {
              if (r.kind !== "t") return null;
              return r.t.dependsOn.map((dep) => {
                const src = r.p.tasks.find((t) => t.id === dep);
                if (!src) return null;
                const x1 = x(src.end) + DAY_W;
                const y1 = rowIndex.get(src.id)! * ROW_H + ROW_H / 2;
                const x2 = x(r.t.start);
                const y2 = rowIndex.get(r.t.id)! * ROW_H + ROW_H / 2;
                const late = x2 < x1;
                return (
                  <path
                    key={dep + r.t.id}
                    d={`M${x1} ${y1} h8 V${y2} H${x2 - 2}`}
                    fill="none"
                    stroke={late ? "#f87171" : "rgba(255,255,255,0.28)"}
                    strokeWidth="1.5"
                    markerEnd="url(#arrow)"
                  />
                );
              });
            })}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10z" fill="rgba(255,255,255,0.45)" />
              </marker>
            </defs>
          </svg>

          {rows.map((r, i) => {
            const top = 46 + i * ROW_H;
            if (r.kind === "p") {
              if (!r.p.tasks.length) return null;
              const s = r.p.tasks.reduce((a, t) => (t.start < a ? t.start : a), r.p.tasks[0].start);
              const e = r.p.tasks.reduce((a, t) => (t.end > a ? t.end : a), r.p.tasks[0].end);
              return <div key={r.p.id} className="absolute h-1.5 rounded-full opacity-70" style={{ top: top + ROW_H / 2 - 3, left: x(s), width: x(e) - x(s) + DAY_W, background: r.p.color }} />;
            }
            const t = preview?.tid === r.t.id ? { ...r.t, ...preview } : r.t;
            const persona = personas.find((p) => p.id === t.personaId);
            const w = x(t.end) - x(t.start) + DAY_W;
            return (
              <motion.div
                key={r.t.id}
                layout={!drag}
                className={clsx("group absolute flex items-center overflow-hidden rounded-lg text-[11.5px] font-medium shadow-lg shadow-black/30", linking && linking !== r.t.id && "ring-2 ring-brand/60 cursor-pointer")}
                style={{ top: top + 6, left: x(t.start) + 1, width: w - 2, height: ROW_H - 12, background: r.p.color + "33", border: `1px solid ${r.p.color}88`, cursor: drag ? "grabbing" : "grab" }}
                onPointerDown={(e) => {
                  if (linking) {
                    if (linking !== r.t.id) {
                      const target = r.p.tasks.find((x) => x.id === linking);
                      if (target) setTask(r.p, linking, { dependsOn: target.dependsOn.includes(r.t.id) ? target.dependsOn.filter((d) => d !== r.t.id) : [...target.dependsOn, r.t.id] });
                    }
                    setLinking(null);
                    return;
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mode = e.clientX - rect.left < 8 ? "l" : rect.right - e.clientX < 8 ? "r" : "move";
                  setDrag({ pid: r.p.id, tid: r.t.id, mode, x0: e.clientX, start: r.t.start, end: r.t.end });
                }}
                title={`${t.name} — ${fmt(fromKey(t.start), "d MMM")} → ${fmt(fromKey(t.end), "d MMM")} · ${t.progress}%`}
              >
                <div className="absolute inset-y-0 left-0" style={{ width: `${t.progress}%`, background: r.p.color + "66" }} />
                <span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" />
                <span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" />
                <span className="relative flex min-w-0 items-center gap-1.5 px-2 text-bright">
                  {persona && <Avatar persona={persona} size={16} />}
                  <span className="truncate">{t.name}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={t.progress}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => setTask(r.p, r.t.id, { progress: +e.target.value })}
                  className="relative ml-auto mr-2 hidden w-14 accent-[#fe7146] group-hover:block"
                  aria-label="Avancement"
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const ganttPlugin: Plugin = {
  id: "gantt",
  name: "Diagramme de Gantt",
  tagline: "Projets en frise : glisser, étirer, lier les tâches, suivre l'avancement.",
  icon: ChartGantt,
  color: "#a855f7",
  category: "productivite",
  defaultOn: true,
  links: ["todo"],
  items: (from, to, s) => {
    const a = dayKey(from);
    const b = dayKey(addDays(to, -1));
    const out: CalItem[] = [];
    for (const p of s.projects) {
      if (!p.showInCalendar) continue;
      for (const t of p.tasks) {
        if (t.end < a || t.start > b) continue;
        out.push({
          id: `gantt-${t.id}`,
          title: `${t.name} · ${t.progress}%`,
          start: fromKey(t.start),
          end: fromKey(t.end),
          allDay: true,
          color: p.color,
          personaIds: t.personaId ? [t.personaId] : [],
          icon: ChartGantt,
          source: "gantt",
        });
      }
    }
    return out;
  },
  view: { id: "gantt", label: "Gantt", icon: ChartGantt, component: GanttView },
};
