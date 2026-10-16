import { addDays, addMonths, addWeeks, addYears, differenceInMinutes } from "date-fns";
import { dayKey, isoWeekday, parseLocal } from "./dates";
import type { CalEvent } from "./types";

export interface Occurrence {
  event: CalEvent;
  start: Date;
  end: Date;
}

/** Occurrences d'un événement qui touchent [from, to). */
export function expand(ev: CalEvent, from: Date, to: Date): Occurrence[] {
  const start = parseLocal(ev.start);
  const end = parseLocal(ev.end);
  const dur = Math.max(differenceInMinutes(end, start), ev.allDay ? 0 : 1);
  const out: Occurrence[] = [];
  const push = (s: Date) => {
    const e = new Date(s.getTime() + dur * 60000);
    const eCmp = ev.allDay ? addDays(e, 1) : e;
    if (eCmp > from && s < to) out.push({ event: ev, start: s, end: e });
  };

  const r = ev.recurrence;
  if (!r) {
    push(start);
    return out;
  }

  const until = r.until ? addDays(parseLocal(r.until), 1) : null;
  const ex = new Set(r.exdates ?? []);
  const limit = until && until < to ? until : to;
  const interval = Math.max(1, r.interval || 1);
  const ok = (d: Date) => !ex.has(dayKey(d)) && d >= start;

  if (r.freq === "weekly" && r.byWeekday?.length) {
    // On parcourt les semaines (pas de interval) puis les jours demandés.
    const weekStart = addDays(start, 1 - isoWeekday(start));
    for (let w = weekStart, i = 0; w < limit && i < 5000; w = addWeeks(w, interval), i++) {
      for (const wd of r.byWeekday) {
        const d = addDays(w, wd - 1);
        d.setHours(start.getHours(), start.getMinutes(), 0, 0);
        if (d < limit && ok(d)) push(d);
      }
    }
    return out;
  }

  const step = (d: Date, n: number) =>
    r.freq === "daily"
      ? addDays(d, n)
      : r.freq === "weekly"
        ? addWeeks(d, n)
        : r.freq === "monthly"
          ? addMonths(d, n)
          : addYears(d, n);

  // Saut rapide jusqu'au voisinage de la plage pour ne pas itérer des années.
  let i = 0;
  let cur = start;
  if (cur < from) {
    const approxDays = { daily: 1, weekly: 7, monthly: 30, yearly: 365 }[r.freq] * interval;
    const skip = Math.max(0, Math.floor((from.getTime() - start.getTime()) / 86400000 / approxDays) - 2);
    i = skip;
    cur = step(start, skip * interval);
  }
  for (; cur < limit && i < 100000; i++, cur = step(start, i * interval)) {
    if (ok(cur)) push(cur);
  }
  return out;
}
