import clsx from "clsx";
import { addDays, isSameDay } from "date-fns";
import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { useMemo } from "react";
import { dayKey, fmt, hhmm } from "../../lib/dates";
import { collectBadges, collectChips, useCalendarData } from "../../plugins/registry";
import { useApp } from "../../store/store";
import { Empty } from "../ui/ui";
import { Badges, Chips, openItem } from "./shared";

export function AgendaView() {
  const cursor = useApp((s) => s.ui.cursor);
  const from = new Date(cursor);
  from.setHours(0, 0, 0, 0);
  const to = addDays(from, 35);
  const { items, plugins, state } = useCalendarData(from, to);
  const personas = state.personas;

  const days = useMemo(() => {
    const out: { d: Date; list: typeof items }[] = [];
    for (let d = from; d < to; d = addDays(d, 1)) {
      const k = dayKey(d);
      const list = items.filter((i) => !i.subtle && (i.allDay ? dayKey(i.start) <= k && dayKey(i.end) >= k : dayKey(i.start) === k));
      out.push({ d, list });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, from.getTime()]);

  const filled = days.filter((x) => x.list.length || collectChips(x.d, state, plugins).length);
  if (!filled.length) return <Empty icon={CalendarDays} text="Rien de prévu sur les 5 prochaines semaines." />;

  return (
    <div className="h-full overflow-y-auto px-3 py-3 sm:px-6">
      <div className="mx-auto grid max-w-3xl gap-1">
        {filled.map(({ d, list }, i) => {
          const isToday = isSameDay(d, new Date());
          return (
            <motion.div
              key={d.getTime()}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className={clsx("grid grid-cols-[64px_1fr] gap-3 rounded-xl px-2 py-2.5", isToday && "bg-sel")}
            >
              <div className="text-center">
                <div className={clsx("text-[11px] uppercase tracking-wider", isToday ? "text-brand" : "text-muted")}>{fmt(d, "EEE")}</div>
                <div className={clsx("text-[22px] font-semibold leading-tight tabular", isToday ? "text-brand" : "text-bright")}>{d.getDate()}</div>
                <div className="text-[10.5px] text-faint">{fmt(d, "MMM")}</div>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <div className="flex items-center gap-2">
                  <Chips chips={collectChips(d, state, plugins)} />
                  <div className="ml-auto">
                    <Badges badges={collectBadges(d, state, plugins)} max={6} />
                  </div>
                </div>
                {list.map((it) => {
                  const I = it.icon;
                  return (
                    <button key={it.id} onClick={() => openItem(it)} className="flex items-center gap-2.5 rounded-lg border border-line bg-base/50 px-2.5 py-2 text-left hover:border-line2 cursor-pointer">
                      <span className="h-8 w-1 rounded-full" style={{ background: it.color }} />
                      {I && <I size={15} color={it.color} />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] text-bright">{it.title}</div>
                        <div className="text-[11.5px] text-muted">
                          {it.allDay ? "Toute la journée" : `${hhmm(it.start)} – ${hhmm(it.end)}`}
                          {it.meta ? ` · ${it.meta}` : ""}
                          {it.warning ? <span className="text-bad"> · ⚠ {it.warning}</span> : null}
                        </div>
                      </div>
                      <div className="flex -space-x-1.5">
                        {it.personaIds.map((id) => {
                          const p = personas.find((x) => x.id === id);
                          return p ? <span key={id} className="h-5 w-5 rounded-full ring-2 ring-panel" style={{ background: p.color }} title={p.name} /> : null;
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

