import clsx from "clsx";
import { addDays, differenceInMinutes, isSameDay } from "date-fns";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cap, dayKey, fmt, hhmm, isoLocal, weekDays } from "../../lib/dates";
import { collectBadges, collectChips, useCalendarData } from "../../plugins/registry";
import type { CalItem } from "../../plugins/types";
import { useApp } from "../../store/store";
import { Avatar } from "../ui/Avatar";
import { Badges, Chips, ItemRow, newEventAt, openItem } from "./shared";

const HOUR = 52;
const SNAP = 15;

interface Placed {
  item: CalItem;
  top: number;
  height: number;
  col: number;
  cols: number;
}

/** Disposition en colonnes des événements qui se chevauchent. */
function layout(items: CalItem[], day: Date): Placed[] {
  const d0 = new Date(day);
  d0.setHours(0, 0, 0, 0);
  const d1 = addDays(d0, 1);
  const rows = items
    .filter((i) => i.start < d1 && i.end > d0)
    .map((item) => {
      const s = Math.max(0, differenceInMinutes(item.start, d0));
      const e = Math.min(24 * 60, differenceInMinutes(item.end, d0));
      return { item, s, e: Math.max(e, s + 20) };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);
  const out: Placed[] = [];
  let cluster: typeof rows = [];
  let clusterEnd = -1;
  const flush = () => {
    const colsEnd: number[] = [];
    const placed = cluster.map((r) => {
      let c = colsEnd.findIndex((end) => end <= r.s);
      if (c < 0) c = colsEnd.push(0) - 1;
      colsEnd[c] = r.e;
      return { r, c };
    });
    for (const { r, c } of placed)
      out.push({ item: r.item, top: (r.s / 60) * HOUR, height: ((r.e - r.s) / 60) * HOUR, col: c, cols: colsEnd.length });
    cluster = [];
  };
  for (const r of rows) {
    if (r.s >= clusterEnd && cluster.length) flush();
    cluster.push(r);
    clusterEnd = Math.max(clusterEnd, r.e);
  }
  if (cluster.length) flush();
  return out;
}

type Drag = { id: string; mode: "move" | "resize"; y0: number; x0: number; start: Date; end: Date; colW: number };

export function TimeGridView({ mode }: { mode: "week" | "day" }) {
  const cursor = useApp((s) => s.ui.cursor);
  const setUI = useApp((s) => s.setUI);
  const update = useApp((s) => s.update);
  const anchor = new Date(cursor);
  anchor.setHours(0, 0, 0, 0);
  const days = useMemo(() => (mode === "week" ? weekDays(anchor) : [anchor]), [mode, anchor.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const from = days[0];
  const to = addDays(days[days.length - 1], 1);
  const { items, plugins, state } = useCalendarData(from, to);
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ghost, setGhost] = useState<{ id: string; start: Date; end: Date } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: HOUR * 7 - 10 });
  }, [mode]);

  // Glisser-déposer des événements : déplacement et redimensionnement au quart d'heure.
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const dm = Math.round(((e.clientY - drag.y0) / HOUR) * 60 / SNAP) * SNAP;
      const dd = mode === "week" ? Math.round((e.clientX - drag.x0) / drag.colW) : 0;
      if (drag.mode === "move") {
        const s = addDays(new Date(drag.start.getTime() + dm * 60000), dd);
        setGhost({ id: drag.id, start: s, end: new Date(s.getTime() + (drag.end.getTime() - drag.start.getTime())) });
      } else {
        const e2 = new Date(Math.max(drag.start.getTime() + SNAP * 60000, drag.end.getTime() + dm * 60000));
        setGhost({ id: drag.id, start: drag.start, end: e2 });
      }
    };
    const up = () => {
      setGhost((g) => {
        if (g && (g.start.getTime() !== drag.start.getTime() || g.end.getTime() !== drag.end.getTime()))
          update("events", g.id, { start: isoLocal(g.start), end: isoLocal(g.end) });
        else if (g) {
          const ev = state.events.find((x) => x.id === g.id);
          if (ev) setUI({ editingEvent: ev });
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
  }, [drag, mode, update, setUI, state.events]);

  const live = useMemo(
    () =>
      items.map((it) =>
        ghost && it.event?.id === ghost.id ? { ...it, start: ghost.start, end: ghost.end } : it,
      ),
    [items, ghost],
  );

  const allDay = live.filter((i) => i.allDay);
  const timedSubtle = live.filter((i) => !i.allDay && i.subtle);
  const timed = live.filter((i) => !i.allDay && !i.subtle);
  const shadePlugins = plugins.filter((p) => p.shade);

  const nowTop = (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR;

  return (
    <div className="flex h-full flex-col">
      {/* En-têtes de jours */}
      <div className="flex border-b border-line pr-2">
        <div className="w-14 shrink-0" />
        {days.map((d) => {
          const isToday = isSameDay(d, now);
          return (
            <div key={d.getTime()} className="flex min-w-0 flex-1 flex-col gap-1 border-l border-line px-2 py-2" onClick={() => setUI({ selectedDay: dayKey(d) })}>
              <div className="flex items-center gap-1.5">
                <span className={clsx("text-[11.5px] uppercase tracking-wider", isToday ? "text-brand" : "text-muted")}>{fmt(d, "EEE")}</span>
                <span className={clsx("grid h-7 min-w-7 place-items-center rounded-lg px-1 text-[15px] font-semibold tabular", isToday ? "bg-brand text-on-brand" : "text-bright")}>{d.getDate()}</span>
                {mode === "day" && <span className="text-[13px] text-muted">{cap(fmt(d, "MMMM yyyy"))}</span>}
                <div className="min-w-0 flex-1">
                  <Badges badges={collectBadges(d, state, plugins)} max={mode === "day" ? 8 : 3} />
                </div>
              </div>
              <Chips chips={collectChips(d, state, plugins)} />
            </div>
          );
        })}
      </div>
      {/* Journée entière */}
      {allDay.length > 0 && (
        <div className="flex max-h-[96px] overflow-y-auto border-b border-line pr-2">
          <div className="w-14 shrink-0 py-1 pr-2 text-right text-[10.5px] text-faint">jour</div>
          {days.map((d) => (
            <div key={d.getTime()} className="flex min-w-0 flex-1 flex-col gap-[2px] border-l border-line p-1">
              {allDay
                .filter((i) => dayKey(i.start) <= dayKey(d) && dayKey(i.end) >= dayKey(d))
                .map((i) => (
                  <ItemRow key={i.id} item={i} onOpen={openItem} />
                ))}
            </div>
          ))}
        </div>
      )}
      {/* Grille horaire */}
      <div ref={scroller} className="relative flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: HOUR * 24 }}>
          <div className="w-14 shrink-0">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="relative pr-2 text-right text-[10.5px] tabular text-faint" style={{ height: HOUR }}>
                {h > 0 && <span className="-translate-y-1/2 inline-block">{String(h).padStart(2, "0")}:00</span>}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const isToday = isSameDay(d, now);
            const placed = layout(timed, d);
            // Couloirs à gauche pour les postes / cours, un par persona.
            const subtle = layout(timedSubtle, d);
            const lanes = [...new Set(subtle.flatMap((p) => p.item.personaIds))];
            const laneW = mode === "day" ? 10 : 6;
            const shades = shadePlugins.flatMap((p) => p.shade!(d, state));
            return (
              <div
                key={d.getTime()}
                className="group/col relative min-w-0 flex-1 border-l border-line"
                onDoubleClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mins = Math.floor(((e.clientY - rect.top) / HOUR) * 60 / 30) * 30;
                  const s = new Date(d);
                  s.setHours(0, mins, 0, 0);
                  newEventAt(s);
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="border-b border-line/60" style={{ height: HOUR }}>
                    <div className="h-1/2 border-b border-dashed border-line/50" />
                  </div>
                ))}
                {shades.map((s, i) => (
                  <div key={i} title={s.label} className="night-shade pointer-events-none absolute inset-x-0" style={{ top: (s.from / 60) * HOUR, height: ((s.to - s.from) / 60) * HOUR }} />
                ))}
                {subtle.map((p) => {
                  const lane = Math.max(0, lanes.indexOf(p.item.personaIds[0]));
                  const I = p.item.icon;
                  const persona = state.personas.find((x) => x.id === p.item.personaIds[0]);
                  return (
                    <div
                      key={p.item.id}
                      title={`${p.item.title} · ${hhmm(p.item.start)}–${hhmm(p.item.end)}`}
                      onClick={() => openItem(p.item)}
                      className="absolute rounded-full cursor-pointer"
                      style={{ top: p.top, height: p.height, left: 2 + lane * (laneW + 2), width: laneW, background: p.item.color + "aa" }}
                    >
                      {mode === "day" && I && p.height > 40 && (
                        <span className="absolute left-1/2 top-1 -translate-x-1/2">
                          <I size={8} color="#111" strokeWidth={3} />
                        </span>
                      )}
                      {persona && mode === "day" && p.height > 60 && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2">
                          <Avatar persona={persona} size={9} />
                        </span>
                      )}
                    </div>
                  );
                })}
                {/* Postes en libellé dans la vue jour */}
                {mode === "day" &&
                  subtle.map((p, i) => (
                    <div key={"l" + p.item.id} className="pointer-events-none absolute text-[10.5px] font-medium" style={{ top: p.top + 2, left: lanes.length * (laneW + 2) + 6 + (i % 2) * 2, color: p.item.color }}>
                      {p.height > 18 ? p.item.title : ""}
                    </div>
                  ))}
                {placed.map((p) => {
                  const it = p.item;
                  const I = it.icon;
                  const offset = lanes.length * (laneW + 2) + 4;
                  const editable = !!it.event && !it.event.recurrence;
                  return (
                    <motion.div
                      key={it.id}
                      layout={!drag}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onPointerDown={(e) => {
                        if (!editable) return;
                        e.stopPropagation();
                        const col = e.currentTarget.parentElement!.getBoundingClientRect();
                        const isResize = (e.target as HTMLElement).dataset.resize === "1";
                        setDrag({ id: it.event!.id, mode: isResize ? "resize" : "move", y0: e.clientY, x0: e.clientX, start: it.start, end: it.end, colW: col.width });
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!editable) openItem(it);
                      }}
                      className={clsx(
                        "absolute overflow-hidden rounded-lg px-1.5 py-1 text-[11.5px] leading-tight shadow-md shadow-black/30",
                        editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                        !!ghost && ghost.id === it.event?.id && "ring-2 ring-brand z-20",
                      )}
                      style={{
                        top: p.top + 1,
                        height: Math.max(18, p.height - 2),
                        left: `calc(${offset}px + (100% - ${offset + 3}px) * ${p.col / p.cols})`,
                        width: `calc((100% - ${offset + 3}px) / ${p.cols} - 2px)`,
                        background: `linear-gradient(180deg, ${it.color}38, ${it.color}22)`,
                        borderLeft: `3px solid ${it.color}`,
                      }}
                    >
                      <div className="flex items-center gap-1 font-medium text-bright">
                        {I && <I size={11} color={it.color} className="shrink-0" />}
                        <span className="truncate">{it.title}</span>
                        {it.warning && <AlertTriangle size={11} className="shrink-0 text-bad" />}
                      </div>
                      {p.height > 32 && (
                        <div className="truncate text-[10.5px] text-muted tabular">
                          {hhmm(it.start)}–{hhmm(it.end)}
                          {it.meta ? ` · ${it.meta}` : ""}
                        </div>
                      )}
                      {p.height > 52 && it.personaIds.length > 0 && (
                        <div className="mt-1 flex -space-x-1">
                          {it.personaIds.map((id) => {
                            const per = state.personas.find((x) => x.id === id);
                            return per ? <Avatar key={id} persona={per} size={16} ring /> : null;
                          })}
                        </div>
                      )}
                      {editable && <div data-resize="1" className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" />}
                    </motion.div>
                  );
                })}
                {isToday && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }}>
                    <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-brand now-dot" />
                    <span className="h-[2px] flex-1 bg-brand" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

