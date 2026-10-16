import clsx from "clsx";
import { addDays, differenceInMinutes } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { dayKey, hhmm } from "./lib/dates";
import { applyTheme, notify } from "./lib/platform";
import { startSync } from "./lib/sync/engine";
import { LEFT_INLINE, RIGHT_INLINE, useMobile, useWidth } from "./lib/useMobile";
import { expand } from "./lib/recurrence";
import { PLUGINS, useEnabledPlugins } from "./plugins/registry";
import type { Plugin } from "./plugins/types";
import { useApp } from "./store/store";
import { CommandPalette } from "./components/panels/CommandPalette";
import { EventEditor } from "./components/panels/EventEditor";
import { PersonaEditor } from "./components/panels/PersonaEditor";
import { PluginStore } from "./components/panels/PluginStore";
import { PrintModal } from "./components/panels/PrintModal";
import { SettingsModal } from "./components/panels/Settings";
import { Onboarding } from "./components/Onboarding";
import { LeftPanel, MobileNav, RightPanel, StatusBar, step, TopBar } from "./components/Shell";
import { AgendaView } from "./components/views/AgendaView";
import { MonthView } from "./components/views/MonthView";
import { TimeGridView } from "./components/views/TimeGridView";
import { newEventAt } from "./components/views/shared";

/** Lance le hook de démarrage d'un plugin seulement s'il est actif. */
function Boot({ plugin }: { plugin: Plugin }) {
  plugin.useBoot!();
  return null;
}


/** Rappels : vérifie chaque 30 s les événements avec un rappel. */
function useReminders() {
  const sent = useRef(new Set<string>());
  useEffect(() => {
    const tick = () => {
      const s = useApp.getState();
      if (!s.settings.notifications) return;
      const now = new Date();
      for (const ev of s.events) {
        if (ev.reminderMin === undefined) continue;
        for (const o of expand(ev, addDays(now, -1), addDays(now, 2))) {
          const at = new Date(o.start.getTime() - ev.reminderMin * 60000);
          const key = `${ev.id}-${o.start.getTime()}`;
          const late = differenceInMinutes(now, at);
          if (late >= 0 && late < 2 && !sent.current.has(key)) {
            sent.current.add(key);
            notify(ev.title || "Rappel", ev.allDay ? "Aujourd'hui" : `${hhmm(o.start)}${ev.location ? ` · ${ev.location}` : ""}`);
          }
        }
      }
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);
}

/** Thème : sombre, clair, ou celui du système (suivi en direct). */
function useTheme() {
  const mode = useApp((s) => s.settings.theme ?? "dark");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => applyTheme(mode === "light" || (mode === "system" && mq.matches));
    apply();
    if (mode !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);
}

function useShortcuts() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const s = useApp.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        s.setUI({ modal: s.ui.modal === "palette" ? null : "palette" });
        return;
      }
      // Ctrl+P ouvre notre mise en page plutôt que d'imprimer l'interface telle quelle.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        s.setUI({ modal: "print" });
        return;
      }
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || s.ui.modal || s.ui.editingEvent || s.ui.editingPersona) return;
      const view = s.settings.view;
      const keys: Record<string, () => void> = {
        t: () => s.setUI({ cursor: Date.now(), selectedDay: dayKey(new Date()) }),
        ArrowLeft: () => s.setUI({ cursor: step(view, s.ui.cursor, -1) }),
        ArrowRight: () => s.setUI({ cursor: step(view, s.ui.cursor, 1) }),
        m: () => s.setSettings({ view: "month" }),
        w: () => s.setSettings({ view: "week" }),
        s: () => s.setSettings({ view: "week" }),
        d: () => s.setSettings({ view: "day" }),
        j: () => s.setSettings({ view: "day" }),
        a: () => s.setSettings({ view: "agenda" }),
        n: () => newEventAt(new Date(Math.ceil(Date.now() / 3600000) * 3600000)),
      };
      const f = keys[e.key];
      if (f) {
        e.preventDefault();
        f();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
}

export default function App() {
  const view = useApp((s) => s.settings.view);
  const { leftOpen, rightOpen, animations, onboarded } = useApp((s) => s.settings);
  const hasPersonas = useApp((s) => s.personas.length > 0);
  const plugins = useEnabledPlugins();
  const mobile = useMobile();
  const width = useWidth();
  const sheet = useApp((s) => s.ui.drawer);
  const setUI = useApp((s) => s.setUI);
  const setSheet = (d: null | "left" | "right") => setUI({ drawer: d });
  // Assez de place pour garder les panneaux à côté du calendrier ?
  const leftInline = !mobile && width >= LEFT_INLINE;
  const rightInline = !mobile && width >= RIGHT_INLINE;
  // En passant en grand écran, un tiroir ouvert devient inutile.
  useEffect(() => {
    if ((sheet === "left" && leftInline) || (sheet === "right" && rightInline)) setUI({ drawer: null });
  }, [leftInline, rightInline]); // eslint-disable-line react-hooks/exhaustive-deps
  useReminders();
  useShortcuts();
  useTheme();
  // Synchronisation du foyer (si cet appareil en fait partie).
  useEffect(() => {
    startSync();
  }, []);

  const pluginView = PLUGINS.find((p) => p.view?.id === view && plugins.includes(p))?.view?.component;
  const content =
    view === "week" ? <TimeGridView mode="week" /> : view === "day" ? <TimeGridView mode="day" /> : view === "agenda" ? <AgendaView /> : pluginView ? (() => { const V = pluginView; return <V />; })() : <MonthView />;

  return (
    <div className={clsx("flex h-full flex-col", !animations && "no-anim")}>
      {plugins.filter((p) => p.useBoot).map((p) => (
        <Boot key={p.id} plugin={p} />
      ))}
      <TopBar mobile={mobile} />
      <div className="flex min-h-0 flex-1 gap-2 px-2">
        {leftInline && (
          <motion.aside animate={{ width: leftOpen ? 268 : 0, opacity: leftOpen ? 1 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 40 }} className={clsx("panel shrink-0 overflow-hidden", !leftOpen && "!border-0")}>
            <div className="h-full w-[268px]">
              <LeftPanel />
            </div>
          </motion.aside>
        )}
        <main className="panel relative min-w-0 flex-1 overflow-hidden">
            <motion.div key={view} initial={{ opacity: 0, scale: 0.995 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.14 }} className="h-full">
              {content}
            </motion.div>
          {!onboarded && !hasPersonas && <Onboarding />}
        </main>
        {rightInline && (
          <motion.aside animate={{ width: rightOpen ? 330 : 0, opacity: rightOpen ? 1 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 40 }} className={clsx("panel shrink-0 overflow-hidden", !rightOpen && "!border-0")}>
            <div className="h-full w-[330px]">
              <RightPanel />
            </div>
          </motion.aside>
        )}
      </div>
      {mobile ? <MobileNav onPanel={setSheet} /> : <StatusBar />}

      {/* Panneaux en tiroir : téléphone, ou fenêtre trop étroite pour les garder à côté. */}
      <AnimatePresence>
        {sheet && ((sheet === "left" && !leftInline) || (sheet === "right" && !rightInline)) && (
          <motion.div className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(null)}>
            <motion.div
              className={clsx("panel safe-top safe-bottom absolute bottom-0 top-0 w-[86vw] max-w-[360px] !rounded-none", sheet === "left" ? "left-0" : "right-0")}
              initial={{ x: sheet === "left" ? "-100%" : "100%" }}
              animate={{ x: 0 }}
              exit={{ x: sheet === "left" ? "-100%" : "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              onClick={(e) => e.stopPropagation()}
            >
              {sheet === "left" ? <LeftPanel /> : <RightPanel />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <EventEditor />
      <PersonaEditor />
      <PluginStore />
      <SettingsModal />
      <CommandPalette />
      <PrintModal />
    </div>
  );
}
