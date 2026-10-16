import clsx from "clsx";
import { addDays, differenceInMinutes, isSameDay, isSameMonth } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { cap, dayKey, fmt, fromKey, isoLocal, monthGrid, parseLocal } from "../../lib/dates";
import { useMobile } from "../../lib/useMobile";
import { Plus } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { step } from "../Shell";
import { holidayOn } from "../../lib/holidays";
import { collectBadges, collectChips, useCalendarData } from "../../plugins/registry";
import type { CalItem } from "../../plugins/types";
import { useApp } from "../../store/store";
import { Badges, Chips, ChipsLabeled, ItemRow, newEventAt, openItem } from "./shared";
import type { CellSize } from "../../lib/types";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function MonthView() {
  const cursor = useApp((s) => s.ui.cursor);
  const selected = useApp((s) => s.ui.selectedDay);
  const setUI = useApp((s) => s.setUI);
  const size: CellSize = useApp((s) => s.settings.cellSize ?? (s.settings.compact ? "compact" : "fit"));
  const compact = size === "compact";
  const large = size === "large";
  const grows = size === "fit" || size === "large";
  const mobile = useMobile();
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
  // Hauteur disponible : les semaines la remplissent au minimum, et grandissent au besoin.
  const box = useRef<HTMLDivElement>(null);
  const [boxH, setBoxH] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Ctrl + molette : cases plus petites / plus grandes.
  useEffect(() => {
    const el = box.current;
    if (!el || mobile) return;
    const order: CellSize[] = ["compact", "normal", "fit", "large"];
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const cur = order.indexOf(useApp.getState().settings.cellSize ?? "fit");
      const next = order[Math.max(0, Math.min(order.length - 1, cur + (e.deltaY < 0 ? 1 : -1)))];
      useApp.getState().setSettings({ cellSize: next });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mobile]);
  const minRow = Math.max(60, Math.floor((boxH - 2) / rows));
  const maxItems = compact ? 2 : grows ? Infinity : 4;

  const moveEvent = (id: string, day: Date) => {
    const ev = state.events.find((e) => e.id === id);
    if (!ev) return;
    const s = parseLocal(ev.start);
    const dur = differenceInMinutes(parseLocal(ev.end), s);
    const ns = new Date(day);
    ns.setHours(s.getHours(), s.getMinutes(), 0, 0);
    state.update("events", id, { start: isoLocal(ns), end: isoLocal(new Date(ns.getTime() + dur * 60000)) });
  };

  const selKey = selected ?? dayKey(today);

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-line px-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={clsx("py-2 text-center font-medium uppercase tracking-wider", mobile ? "text-[10.5px]" : "text-[11.5px]", i >= 5 ? "text-faint" : "text-muted")}>
            {mobile ? d.slice(0, 1) : d}
          </div>
        ))}
      </div>
      <motion.div
        ref={box}
        className={clsx("relative overflow-hidden", mobile ? "flex-[1.25]" : "flex-1")}
        style={{ touchAction: "pan-y" }}
        onPanEnd={(_, info) => {
          // Glisser à gauche / à droite : mois suivant / précédent.
          if (Math.abs(info.offset.x) < 60 || Math.abs(info.offset.x) < Math.abs(info.offset.y) * 1.5) return;
          setUI({ cursor: step("month", cursor, info.offset.x < 0 ? 1 : -1) });
        }}
      >
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
            className={clsx("absolute inset-0", grows && !mobile ? "overflow-y-auto" : "overflow-hidden")}
          >
            <div
              className={clsx("grid grid-cols-7 gap-px bg-line p-px", (!grows || mobile) && "h-full")}
              style={{
                gridTemplateRows:
                  grows && !mobile
                    ? `repeat(${rows}, minmax(${large ? Math.max(minRow, 170) : minRow}px, auto))`
                    : `repeat(${rows}, minmax(0, 1fr))`,
              }}
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
                    if (mobile) return;
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
                    "group relative flex min-h-0 flex-col transition-colors cursor-default",
                    grows && !mobile ? "overflow-visible" : "overflow-hidden",
                    mobile ? "items-center gap-[3px] p-1" : large ? "gap-1 p-2" : "gap-[3px] p-1.5",
                    out ? "bg-base/70" : weekend || hol ? "bg-weekend" : "bg-panel",
                    selected === k && "!bg-selday",
                    "hover:bg-elev/60",
                  )}
                >
                  {selected === k && <motion.div layoutId="sel-day" className="pointer-events-none absolute inset-0 rounded-[2px] ring-1 ring-inset ring-brand/50" />}
                  {mobile ? (
                    <MobileCell d={d} isToday={isToday} out={out} list={list} chips={deco.chips} hasBadge={deco.badges.length > 0} />
                  ) : (
                  <>
                  <div className="flex items-center gap-1">
                    <span
                      className={clsx(
                        "grid shrink-0 place-items-center whitespace-nowrap rounded-md px-1 tabular",
                        large ? "h-7 min-w-7 text-[14px]" : "h-6 min-w-6 text-[12.5px]",
                        isToday ? "bg-brand font-semibold text-on-brand now-dot" : out ? "text-faint" : "text-bright",
                      )}
                    >
                      {d.getDate() === 1 && !isToday ? fmt(d, "d MMM") : d.getDate()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Badges badges={deco.badges} max={large ? 5 : 3} />
                    </div>
                  </div>
                  {large ? <ChipsLabeled chips={deco.chips} /> : <Chips chips={deco.chips} compact={compact} />}
                  <div className="flex min-h-0 flex-col gap-[2px]">
                    {list.slice(0, maxItems).map((it) => (
                      <ItemRow key={it.id} item={it} onOpen={openItem} large={large} />
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
                  </>
                  )}
                </motion.div>
              );
            })}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
      {mobile && (
        <MobileDayList
          dayK={selKey}
          list={perDay.get(selKey) ?? []}
          chips={decorations.get(selKey)?.chips ?? []}
          badges={decorations.get(selKey)?.badges ?? []}
        />
      )}
    </div>
  );
}

type Chip = ReturnType<typeof collectChips>[number];
type Badge = ReturnType<typeof collectBadges>[number];

/** Case du mois sur téléphone : numéro, puis des points de couleur (postes, événements). */
function MobileCell({ d, isToday, out, list, chips, hasBadge }: { d: Date; isToday: boolean; out: boolean; list: CalItem[]; chips: Chip[]; hasBadge: boolean }) {
  return (
    <>
      <span
        className={clsx(
          "relative grid h-6 w-6 place-items-center rounded-full text-[12.5px] tabular",
          isToday ? "bg-brand font-semibold text-on-brand" : out ? "text-faint" : "text-bright",
        )}
      >
        {d.getDate()}
        {hasBadge && !isToday && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-brand/70" />}
      </span>
      {chips.length > 0 && (
        <div className="flex max-w-full flex-wrap justify-center gap-[2px]">
          {chips.slice(0, 4).map((c) => {
            const I = c.icon;
            return (
              <span key={c.id} className="grid h-[13px] w-[13px] place-items-center rounded-full" style={{ background: c.color + "33" }}>
                <I size={8} color={c.color} strokeWidth={3} />
              </span>
            );
          })}
        </div>
      )}
      <div className="flex w-full flex-col gap-[2px] px-0.5">
        {list.slice(0, 3).map((it) => (
          <span key={it.id} className="h-[3px] w-full rounded-full" style={{ background: it.color }} />
        ))}
        {list.length > 3 && <span className="text-center text-[8.5px] leading-none text-muted">+{list.length - 3}</span>}
      </div>
    </>
  );
}

/** Sous la grille sur téléphone : le détail du jour choisi. */
function MobileDayList({ dayK, list, chips, badges }: { dayK: string; list: CalItem[]; chips: Chip[]; badges: Badge[] }) {
  const personas = useApp((s) => s.personas);
  const day = fromKey(dayK);
  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-line">
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <div className="min-w-0 flex-1 truncate text-[15px] font-semibold text-bright">{cap(fmt(day, "EEEE d MMMM"))}</div>
        <Badges badges={badges} max={4} />
        <button
          className="grid h-8 w-8 place-items-center rounded-lg bg-elev text-brand cursor-pointer"
          aria-label="Ajouter ce jour-là"
          onClick={() => {
            const s = new Date(day);
            s.setHours(9, 0, 0, 0);
            newEventAt(s);
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={dayK}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex-1 overflow-y-auto px-3 pb-24"
        >
          {chips.length > 0 && (
            <div className="mb-2 grid gap-1">
              {chips.map((c) => {
                const p = personas.find((x) => x.id === c.personaId);
                const I = c.icon;
                return p ? (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]" style={{ background: c.color + "14" }}>
                    <Avatar persona={p} size={22} />
                    <span className="flex-1 text-bright">{p.name}</span>
                    <span className="flex items-center gap-1 text-[12px]" style={{ color: c.color }}>
                      <I size={14} /> {c.label}
                    </span>
                  </div>
                ) : null;
              })}
            </div>
          )}
          <div className="grid gap-1.5">
            {list.map((it) => {
              const I = it.icon;
              return (
                <button
                  key={it.id}
                  onClick={() => openItem(it)}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-base/50 px-2.5 py-2 text-left active:scale-[0.99] cursor-pointer"
                >
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: it.color }} />
                  {I && <I size={15} color={it.color} className="shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] text-bright">{it.title}</div>
                    <div className="text-[12px] text-muted">
                      {it.allDay ? "Toute la journée" : `${fmt(it.start, "HH:mm")} – ${fmt(it.end, "HH:mm")}`}
                      {it.warning ? <span className="text-bad"> · ⚠ {it.warning}</span> : null}
                    </div>
                  </div>
                </button>
              );
            })}
            {!list.length && !chips.length && <p className="py-6 text-center text-[13px] text-faint">Journée libre.</p>}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
