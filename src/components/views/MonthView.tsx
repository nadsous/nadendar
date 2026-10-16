import clsx from "clsx";
import { addDays, differenceInMinutes, isSameDay, isSameMonth } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef } from "react";
import { dayKey, fmt, isoLocal, monthGrid, parseLocal } from "../../lib/dates";
import { holidayOn } from "../../lib/holidays";
import { collectBadges, collectChips, useCalendarData } from "../../plugins/registry";
import type { CalItem } from "../../plugins/types";
import { useApp } from "../../store/store";
import { Badges, Chips, ItemRow, newEventAt, openItem } from "./shared";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function MonthView() {
  const cursor = useApp((s) => s.ui.cursor);
  const selected = useApp((s) => s.ui.selectedDay);
  const setUI = useApp((s) => s.setUI);
  const compact = useApp((s) => s.settings.compact);
  const anchor = new Date(cursor);
  const days = useMemo(() => monthGrid(anchor), [anchor.getFullYear(), anchor.getMonth()]); // eslint-disable-line react-hooks/exhaustive-deps
  const from = days[0];
  const to = addDays(days[days.length - 1], 1);
  const { items, plugins, state } = useCalendarData(from, to);

  // Direction de l'animation entre deux mois.
  const prev = useRef(cursor);
  const dir = cursor >= prev.current ? 1 : -1;
  prev.current = cursor;

  const perDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of items) {
      // Les postes et cours sont résumés par les pastilles : pas de ligne dans la case.
      if (it.subtle) continue;
      if (it.allDay) {
        for (let d = new Date(it.start); d <= it.end && d < to; d = addDays(d, 1)) {
          const k = dayKey(d);
          map.set(k, [...(map.get(k) ?? []), it]);
        }
      } else {
        const k = dayKey(it.start);
        map.set(k, [...(map.get(k) ?? []), it]);
      }
    }
    return map;
  }, [items, to]);

  const decorations = useMemo(
    () => new Map(days.map((d) => [dayKey(d), { badges: collectBadges(d, state, plugins), chips: collectChips(d, state, plugins) }])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, plugins, state.cache, state.patterns, state.leaves, state.personas, state.money, state.meals],
  );

  const today = new Date();
  const rows = days.length / 7;
  const maxItems = compact ? 2 : 4;

  const moveEvent = (id: string, day: Date) => {
    const ev = state.events.find((e) => e.id === id);
    if (!ev) return;
    const s = parseLocal(ev.start);
    const dur = differenceInMinutes(parseLocal(ev.end), s);
    const ns = new Date(day);
    ns.setHours(s.getHours(), s.getMinutes(), 0, 0);
    state.update("events", id, { start: isoLocal(ns), end: isoLocal(new Date(ns.getTime() + dur * 60000)) });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-line px-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={clsx("py-2 text-center text-[11.5px] font-medium uppercase tracking-wider", i >= 5 ? "text-faint" : "text-muted")}>
            {d}
          </div>
        ))}
      </div>
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={`${anchor.getFullYear()}-${anchor.getMonth()}`}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, y: d * 40 }),
              center: { opacity: 1, y: 0 },
              exit: (d: number) => ({ opacity: 0, y: d * -40 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="absolute inset-0 grid grid-cols-7 gap-px bg-line p-px"
            style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
          >
            {days.map((d, i) => {
              const k = dayKey(d);
              const list = perDay.get(k) ?? [];
              const deco = decorations.get(k)!;
              const isToday = isSameDay(d, today);
              const out = !isSameMonth(d, anchor);
              const weekend = i % 7 >= 5;
              const hol = holidayOn(d);
              return (
                <motion.div
                  key={k}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.006, 0.2) }}
                  onClick={() => setUI({ selectedDay: k })}
                  onDoubleClick={() => {
                    const s = new Date(d);
                    s.setHours(9, 0, 0, 0);
                    newEventAt(s);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("text/nadendar-event");
                    if (id) moveEvent(id, d);
                  }}
                  className={clsx(
                    "group relative flex min-h-0 flex-col gap-[3px] overflow-hidden p-1.5 transition-colors cursor-default",
                    out ? "bg-base/70" : weekend || hol ? "bg-weekend" : "bg-panel",
                    selected === k && "!bg-selday",
                    "hover:bg-elev/60",
                  )}
                >
                  {selected === k && <motion.div layoutId="sel-day" className="pointer-events-none absolute inset-0 rounded-[2px] ring-1 ring-inset ring-brand/50" />}
                  <div className="flex items-center gap-1">
                    <span
                      className={clsx(
                        "grid h-6 min-w-6 shrink-0 place-items-center whitespace-nowrap rounded-md px-1 text-[12.5px] tabular",
                        isToday ? "bg-brand font-semibold text-on-brand now-dot" : out ? "text-faint" : "text-bright",
                      )}
                    >
                      {d.getDate() === 1 && !isToday ? fmt(d, "d MMM") : d.getDate()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Badges badges={deco.badges} max={3} />
                    </div>
                  </div>
                  <Chips chips={deco.chips} compact={compact} />
                  <div className="flex min-h-0 flex-col gap-[2px]">
                    {list.slice(0, maxItems).map((it) => (
                      <ItemRow key={it.id} item={it} onOpen={openItem} />
                    ))}
                    {list.length > maxItems && (
                      <button
                        className="self-start rounded px-1 text-[11px] font-medium text-muted hover:text-brand cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUI({ selectedDay: k });
                          useApp.getState().setSettings({ rightOpen: true, rightTab: "today" });
                        }}
                      >
                        +{list.length - maxItems} autres
                      </button>
                    )}
                  </div>
                  <button
                    className="absolute bottom-1 right-1 hidden h-5 w-5 place-items-center rounded-md bg-elev text-muted hover:text-brand group-hover:grid cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      const s = new Date(d);
                      s.setHours(9, 0, 0, 0);
                      newEventAt(s);
                    }}
                    aria-label="Ajouter"
                  >
                    +
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
