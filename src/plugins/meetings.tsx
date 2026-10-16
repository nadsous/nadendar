import { addDays, differenceInMinutes, isToday } from "date-fns";
import { motion } from "framer-motion";
import { Plus, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cap, fmt, hhmm, isoLocal } from "../lib/dates";
import { openExternal } from "../lib/platform";
import { expand } from "../lib/recurrence";
import { useApp } from "../store/store";
import { MEETING } from "../components/ui/icons";
import { Button, Empty } from "../components/ui/ui";
import type { Plugin } from "./types";

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function useUpcoming(days = 14) {
  const events = useApp((s) => s.events);
  const now = useNow();
  return useMemo(() => {
    const to = addDays(now, days);
    return events
      .filter((e) => e.meeting)
      .flatMap((e) => expand(e, now, to))
      .filter((o) => o.end > now)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [events, now, days]);
}

export function JoinButton({ provider, url, phone }: { provider: keyof typeof MEETING; url?: string; phone?: string }) {
  const m = MEETING[provider];
  const target = url || (phone ? `tel:${phone.replace(/\s/g, "")}` : "");
  if (!target) return null;
  return (
    <Button
      size="sm"
      variant="primary"
      icon={m.icon}
      onClick={(e) => {
        e.stopPropagation();
        openExternal(target);
      }}
    >
      {provider === "doctolib" ? "Ouvrir" : provider === "telephone" ? "Appeler" : "Rejoindre"}
    </Button>
  );
}

function Panel() {
  const list = useUpcoming();
  const setUI = useApp((s) => s.setUI);
  const now = useNow();
  const newMeeting = () => {
    const s = new Date();
    s.setMinutes(Math.ceil(s.getMinutes() / 30) * 30, 0, 0);
    setUI({
      editingEvent: {
        title: "",
        kind: "meeting",
        start: isoLocal(s),
        end: isoLocal(new Date(s.getTime() + 30 * 60000)),
        allDay: false,
        personaIds: [],
        meeting: { provider: "meet" },
        reminderMin: 10,
      },
    });
  };
  return (
    <div className="grid gap-2">
      <Button icon={Plus} onClick={newMeeting}>
        Nouvelle réunion / rendez-vous
      </Button>
      {!list.length && <Empty icon={Video} text="Aucune réunion dans les 14 prochains jours." />}
      {list.map((o, i) => {
        const m = MEETING[o.event.meeting!.provider];
        const mins = differenceInMinutes(o.start, now);
        const live = mins <= 0;
        return (
          <motion.button
            key={o.event.id + o.start.getTime()}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => setUI({ editingEvent: o.event })}
            className="flex flex-col gap-1.5 rounded-xl border border-line bg-base/50 p-2.5 text-left hover:border-line2 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: m.color + "22", color: m.color }}>
                <m.icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-bright">{o.event.title || m.label}</div>
                <div className="text-[11.5px] text-muted">
                  {isToday(o.start) ? "Aujourd'hui" : cap(fmt(o.start, "EEE d MMM"))} · {hhmm(o.start)}–{hhmm(o.end)}
                </div>
              </div>
              {live ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-ok">
                  <span className="h-1.5 w-1.5 rounded-full bg-ok now-dot" /> En cours
                </span>
              ) : mins < 60 ? (
                <span className="text-[11px] font-medium text-brand">dans {mins} min</span>
              ) : null}
            </div>
            {(mins < 15 || live) && <JoinButton {...o.event.meeting!} />}
          </motion.button>
        );
      })}
    </div>
  );
}

function Status() {
  const list = useUpcoming(1);
  const now = useNow();
  const next = list[0];
  if (!next) return null;
  const mins = differenceInMinutes(next.start, now);
  if (mins > 120) return null;
  const m = MEETING[next.event.meeting!.provider];
  return (
    <button
      className="flex items-center gap-1.5 text-brand cursor-pointer"
      onClick={() => next.event.meeting?.url && openExternal(next.event.meeting.url)}
      title={`${m.label} — ${next.event.title}`}
    >
      <m.icon size={13} />
      {mins <= 0 ? "Réunion en cours" : `Réunion dans ${mins} min`}
    </button>
  );
}

export const meetingsPlugin: Plugin = {
  id: "meetings",
  name: "Réunions & RDV",
  tagline: "Meet, Teams, Zoom, Doctolib, WhatsApp : lien en un clic, compte à rebours, rappel.",
  icon: Video,
  color: "#22c55e",
  category: "travail",
  defaultOn: true,
  links: ["mail", "workplan"],
  panel: { label: "Réunions", component: Panel },
  status: Status,
};
