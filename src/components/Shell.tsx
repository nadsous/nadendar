import clsx from "clsx";
import { addDays, addMonths, addWeeks, isSameDay, isSameMonth } from "date-fns";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Monitor,
  Moon,
  Eye,
  EyeOff,
  List,
  PanelLeft,
  PanelRight,
  Plus,
  Printer,
  Rows2,
  Rows3,
  Rows4,
  UnfoldVertical,
  Puzzle,
  Search,
  Settings2,
  Square,
  Sun,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import logo from "../assets/logo.svg";
import { cap, dayKey, fmt, fromKey, monthGrid } from "../lib/dates";
import { isMobileWidth, weekSpan, weekStart } from "../lib/useMobile";
import { collectBadges, collectChips, useCalendarData, useEnabledPlugins } from "../plugins/registry";
import { togglePanel, useApp } from "../store/store";
import { Avatar } from "./ui/Avatar";
import { Button, IconBtn } from "./ui/ui";
import { Badges, Chips, ItemRow, newEventAt, openItem } from "./views/shared";
import { blankPersona } from "./panels/PersonaEditor";
import { SyncBadge } from "./panels/SyncPanel";

export const CORE_VIEWS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "month", label: "Mois", icon: CalendarDays },
  { id: "week", label: "Semaine", icon: Columns3 },
  { id: "day", label: "Jour", icon: Square },
  { id: "agenda", label: "Agenda", icon: List },
];

export function useViews() {
  const plugins = useEnabledPlugins();
  return [...CORE_VIEWS, ...plugins.filter((p) => p.view).map((p) => ({ id: p.view!.id, label: p.view!.label, icon: p.view!.icon }))];
}

export function step(view: string, cursor: number, n: number) {
  const d = new Date(cursor);
  if (view === "week") return addDays(d, n * weekSpan()).getTime();
  if (view === "day") return addDays(d, n).getTime();
  if (view === "agenda") return addWeeks(d, n).getTime();
  return addMonths(d, n).getTime();
}

function title(view: string, cursor: number) {
  const d = new Date(cursor);
  if (view === "week") {
    const s = weekStart(cursor);
    const e = addDays(s, weekSpan() - 1);
    if (isMobileWidth()) return s.getMonth() === e.getMonth() ? `${s.getDate()} – ${fmt(e, "d MMM")}` : `${fmt(s, "d MMM")} – ${fmt(e, "d MMM")}`;
    return s.getMonth() === e.getMonth() ? `${s.getDate()} – ${e.getDate()} ${fmt(e, "MMMM yyyy")}` : `${fmt(s, "d MMM")} – ${fmt(e, "d MMM yyyy")}`;
  }
  if (view === "day") return cap(fmt(d, isMobileWidth() ? "EEE d MMM" : "EEEE d MMMM yyyy"));
  if (view === "agenda") return `À partir du ${fmt(d, "d MMMM")}`;
  return cap(fmt(d, "MMMM yyyy"));
}

const THEMES = [
  { id: "dark", label: "Thème sombre", icon: Moon },
  { id: "light", label: "Thème clair", icon: Sun },
  { id: "system", label: "Thème du système", icon: Monitor },
] as const;

export const CELL_SIZES = [
  { id: "compact", label: "Cases compactes", icon: Rows4 },
  { id: "normal", label: "Cases normales (tout tient à l'écran)", icon: Rows3 },
  { id: "fit", label: "Auto : chaque semaine s'agrandit pour tout afficher", icon: UnfoldVertical },
  { id: "large", label: "Grandes cases, textes en clair", icon: Rows2 },
] as const;

function CellSizePicker() {
  const size = useApp((s) => s.settings.cellSize ?? (s.settings.compact ? "compact" : "fit"));
  const setSettings = useApp((s) => s.setSettings);
  return (
    <div className="pill-group" title="Taille des cases (Ctrl + molette)">
      {CELL_SIZES.map((c) => (
        <button
          key={c.id}
          title={c.label}
          aria-label={c.label}
          // Les grandes cases ont besoin de largeur : on replie les panneaux latéraux.
          onClick={() => setSettings(c.id === "large" ? { cellSize: c.id, leftOpen: false, rightOpen: false } : { cellSize: c.id })}
          className={clsx(
            "relative grid h-8 w-8 place-items-center rounded-lg transition-colors cursor-pointer",
            size === c.id ? "text-brand" : "text-muted hover:text-bright",
          )}
        >
          {size === c.id && <motion.span layoutId="cell-size" className="absolute inset-0 rounded-lg bg-elev" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <c.icon size={15} className="relative" />
        </button>
      ))}
    </div>
  );
}

/** Bascule sombre → clair → système. */
function ThemeButton() {
  const theme = useApp((s) => s.settings.theme ?? "dark");
  const setSettings = useApp((s) => s.setSettings);
  const i = THEMES.findIndex((t) => t.id === theme);
  const cur = THEMES[i < 0 ? 0 : i];
  const next = THEMES[(Math.max(0, i) + 1) % THEMES.length];
  return (
    <button
      title={`${cur.label} — cliquer pour : ${next.label.toLowerCase()}`}
      aria-label={cur.label}
      onClick={() => setSettings({ theme: next.id })}
      className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-lg text-muted hover:bg-elev hover:text-bright cursor-pointer"
    >
        <motion.span key={cur.id} initial={{ y: 14, rotate: -90, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} transition={{ duration: 0.18 }}>
          <cur.icon size={16} strokeWidth={1.9} />
        </motion.span>
    </button>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return <img src={logo} width={size} height={size} alt="" className="rounded-[7px]" draggable={false} />;
}

export function TopBar({ mobile }: { mobile: boolean }) {
  const view = useApp((s) => s.settings.view);
  const cursor = useApp((s) => s.ui.cursor);
  const { leftOpen, rightOpen } = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const setUI = useApp((s) => s.setUI);
  const views = useViews();

  return (
    <header className="safe-top flex h-[46px] shrink-0 items-center gap-2 overflow-hidden px-2.5" data-tauri-drag-region>
      <div className={clsx("pill-group shrink-0", !mobile && "!pr-3")}>
        {!mobile && <IconBtn icon={PanelLeft} label="Panneau de gauche" active={leftOpen} onClick={() => togglePanel("left")} />}
        <Logo size={24} />
        {!mobile && (
          <span className="hidden text-[14px] font-semibold tracking-[-0.02em] text-bright lg:inline">
            Nad<span className="text-brand">endar</span>
          </span>
        )}
      </div>
      <div className="pill-group shrink-0">
        <IconBtn icon={ChevronLeft} label="Précédent" onClick={() => setUI({ cursor: step(view, cursor, -1) })} />
        <button className="h-8 rounded-lg px-2.5 text-[13px] font-medium text-fg hover:bg-elev hover:text-bright cursor-pointer" onClick={() => setUI({ cursor: Date.now(), selectedDay: dayKey(new Date()) })}>
          {mobile ? "Auj." : "Aujourd'hui"}
        </button>
        <IconBtn icon={ChevronRight} label="Suivant" onClick={() => setUI({ cursor: step(view, cursor, 1) })} />
      </div>
        <motion.h1
          key={title(view, cursor)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className={clsx("min-w-0 truncate px-1 font-semibold tracking-[-0.02em] text-bright", mobile ? "text-[14px]" : "shrink-0 text-[16px]")}
        >
          {title(view, cursor)}
        </motion.h1>
      <span className="flex-1" data-tauri-drag-region />
      {!mobile && view === "month" && (
        <div className="hidden xl:block">
          <CellSizePicker />
        </div>
      )}
      {!mobile && (
        <div className="pill-group shrink-0">
          {views.map((v) => (
            <button
              key={v.id}
              title={v.label}
              aria-label={v.label}
              onClick={() => setSettings({ view: v.id })}
              className={clsx("relative flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors cursor-pointer", view === v.id ? "text-bright" : "text-muted hover:text-fg")}
            >
              {view === v.id && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-lg bg-elev" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <v.icon size={14} className={clsx("relative", view === v.id && "text-brand")} />
              <span className="relative hidden 2xl:inline">{v.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="pill-group shrink-0">
        <IconBtn icon={Search} label="Rechercher (Ctrl+K)" onClick={() => setUI({ modal: "palette" })} />
        <ThemeButton />
        {!mobile && <IconBtn icon={Printer} label="Imprimer / PDF (Ctrl+P)" onClick={() => setUI({ modal: "print" })} />}
        {!mobile && <IconBtn icon={Puzzle} label="Plugins" onClick={() => setUI({ modal: "plugins" })} />}
        <IconBtn icon={Settings2} label="Réglages" onClick={() => setUI({ modal: "settings" })} />
        {!mobile && <IconBtn icon={PanelRight} label="Panneau de droite" active={rightOpen} onClick={() => togglePanel("right")} />}
      </div>
      {!mobile && (
        <Button variant="primary" icon={Plus} className="shrink-0" title="Créer (N)" onClick={() => newEventAt(new Date(Math.ceil(Date.now() / 3600000) * 3600000))}>
          <span className="hidden xl:inline">Créer</span>
        </Button>
      )}
    </header>
  );
}

function MiniMonth() {
  const cursor = useApp((s) => s.ui.cursor);
  const selected = useApp((s) => s.ui.selectedDay);
  const setUI = useApp((s) => s.setUI);
  const anchor = new Date(cursor);
  const days = useMemo(() => monthGrid(anchor), [anchor.getFullYear(), anchor.getMonth()]); // eslint-disable-line react-hooks/exhaustive-deps
  const { items } = useCalendarData(days[0], addDays(days[days.length - 1], 1));
  const busy = useMemo(() => new Set(items.filter((i) => !i.subtle).map((i) => dayKey(i.start))), [items]);
  const today = new Date();
  return (
    <div className="select-none">
      <div className="mb-1.5 flex items-center px-1">
        <span className="flex-1 text-[13px] font-semibold text-bright">{cap(fmt(anchor, "MMMM yyyy"))}</span>
        <IconBtn icon={ChevronLeft} label="Mois précédent" size={14} className="!h-6 !w-6" onClick={() => setUI({ cursor: addMonths(anchor, -1).getTime() })} />
        <IconBtn icon={ChevronRight} label="Mois suivant" size={14} className="!h-6 !w-6" onClick={() => setUI({ cursor: addMonths(anchor, 1).getTime() })} />
      </div>
      <div className="grid grid-cols-7 text-center text-[10.5px] text-faint">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const k = dayKey(d);
          const isToday = isSameDay(d, today);
          return (
            <button
              key={k}
              onClick={() => setUI({ cursor: d.getTime(), selectedDay: k })}
              className={clsx(
                "relative mx-auto my-[1px] grid h-7 w-7 place-items-center rounded-lg text-[12px] tabular transition-colors cursor-pointer",
                isToday ? "bg-brand font-semibold text-on-brand" : selected === k ? "bg-sel text-bright" : isSameMonth(d, anchor) ? "text-fg hover:bg-elev" : "text-faint hover:bg-elev",
              )}
            >
              {d.getDate()}
              {busy.has(k) && !isToday && <span className="absolute bottom-[3px] h-[3px] w-[3px] rounded-full bg-brand" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PersonaList() {
  const personas = useApp((s) => s.personas);
  const setUI = useApp((s) => s.setUI);
  const update = useApp((s) => s.update);
  return (
    <div className="grid gap-0.5">
      <div className="mb-1 flex items-center px-1">
        <span className="flex-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">Personas</span>
        <IconBtn icon={UserPlus} label="Nouveau persona" size={14} className="!h-6 !w-6" onClick={() => setUI({ editingPersona: blankPersona(personas.length) })} />
      </div>
      {personas.map((p, i) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className={clsx("group flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-elev cursor-pointer", p.hidden && "opacity-45")}
          onClick={() => setUI({ editingPersona: p })}
        >
          <Avatar persona={p} size={30} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-bright">{p.name}</div>
            <div className="truncate text-[11px] text-faint">{p.job || p.school?.level || cap(p.role)}</div>
          </div>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          <button
            className="text-faint opacity-0 hover:text-bright group-hover:opacity-100 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              update("personas", p.id, { hidden: !p.hidden });
            }}
            title={p.hidden ? "Afficher dans le calendrier" : "Masquer du calendrier"}
          >
            {p.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </motion.div>
      ))}
      {!personas.length && (
        <button className="rounded-xl border border-dashed border-line2 px-3 py-3 text-[12.5px] text-muted hover:border-brand hover:text-brand cursor-pointer" onClick={() => setUI({ editingPersona: blankPersona(0) })}>
          + Créer le premier persona
        </button>
      )}
    </div>
  );
}

export function LeftPanel() {
  const plugins = useEnabledPlugins();
  const setUI = useApp((s) => s.setUI);
  const views = useViews();
  const view = useApp((s) => s.settings.view);
  const setSettings = useApp((s) => s.setSettings);
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-3">
      <MiniMonth />
      {/* Sur mobile, la barre du haut n'a pas la place pour toutes les vues. */}
      <div className="grid grid-cols-2 gap-1 min-[820px]:hidden">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setSettings({ view: v.id })}
            className={clsx("flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] cursor-pointer", view === v.id ? "bg-sel text-bright" : "bg-elev/50 text-muted")}
          >
            <v.icon size={15} className={view === v.id ? "text-brand" : undefined} /> {v.label}
          </button>
        ))}
        <button onClick={() => setUI({ modal: "print" })} className="flex items-center gap-2 rounded-lg bg-elev/50 px-2.5 py-2 text-[13px] text-muted cursor-pointer">
          <Printer size={15} /> Imprimer / PDF
        </button>
        <button onClick={() => setUI({ modal: "plugins" })} className="flex items-center gap-2 rounded-lg bg-elev/50 px-2.5 py-2 text-[13px] text-muted cursor-pointer">
          <Puzzle size={15} /> Plugins
        </button>
      </div>
      <PersonaList />
      <div className="mt-auto grid gap-1">
        <span className="px-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">Plugins actifs</span>
        <div className="flex flex-wrap gap-1 px-0.5">
          {plugins.map((p) => (
            <span key={p.id} title={p.name} className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: p.color + "1c", color: p.color }}>
              <p.icon size={14} />
            </span>
          ))}
          <button className="grid h-7 w-7 place-items-center rounded-lg border border-dashed border-line2 text-muted hover:text-brand cursor-pointer" onClick={() => setUI({ modal: "plugins" })} aria-label="Gérer les plugins">
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Résumé d'une journée : météo, soleil, qui travaille, éléments, rappels. */
function DaySummary() {
  const selected = useApp((s) => s.ui.selectedDay);
  const day = selected ? fromKey(selected) : new Date();
  day.setHours(0, 0, 0, 0);
  const { items, plugins, state } = useCalendarData(day, addDays(day, 1));
  const list = items.filter((i) => !i.subtle || i.allDay);
  const badges = collectBadges(day, state, plugins);
  const chips = collectChips(day, state, plugins);
  const isToday = isSameDay(day, new Date());
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <div>
          <div className={clsx("text-[11.5px] font-medium uppercase tracking-wider", isToday ? "text-brand" : "text-muted")}>{isToday ? "Aujourd'hui" : fmt(day, "EEEE")}</div>
          <div className="text-[19px] font-semibold tracking-[-0.02em] text-bright">{cap(fmt(day, "d MMMM yyyy"))}</div>
        </div>
        <span className="flex-1" />
        <Badges badges={badges} max={6} />
      </div>
      <Chips chips={chips} />
      {plugins
        .filter((p) => p.dayDetail)
        .map((p) => {
          const D = p.dayDetail!;
          return <D key={p.id} day={day} />;
        })}
      <div className="grid gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">Au programme</span>
          <IconBtn
            icon={Plus}
            label="Ajouter"
            size={14}
            className="!h-6 !w-6"
            onClick={() => {
              const s = new Date(day);
              s.setHours(isToday ? new Date().getHours() + 1 : 9, 0, 0, 0);
              newEventAt(s);
            }}
          />
        </div>
        {list.length ? list.map((i) => <ItemRow key={i.id} item={i} onOpen={openItem} />) : <span className="px-1 text-[12.5px] text-faint">Journée libre.</span>}
      </div>
    </div>
  );
}

export function RightPanel() {
  const tab = useApp((s) => s.settings.rightTab);
  const setSettings = useApp((s) => s.setSettings);
  const plugins = useEnabledPlugins().filter((p) => p.panel);
  const tabs = [{ id: "today", label: "Jour", icon: Sun, color: "#fe7146" }, ...plugins.map((p) => ({ id: p.id, label: p.panel!.label, icon: p.icon, color: p.color }))];
  const current = tabs.find((t) => t.id === tab) ? tab : "today";
  const P = plugins.find((p) => p.id === current)?.panel?.component;
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSettings({ rightTab: t.id })}
            title={t.label}
            className={clsx("relative flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium cursor-pointer", current === t.id ? "text-bright" : "text-muted hover:text-fg")}
          >
            {current === t.id && <motion.span layoutId="right-tab" className="absolute inset-0 rounded-lg bg-elev" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <t.icon size={14} className="relative" style={{ color: current === t.id ? t.color : undefined }} />
            {current === t.id && <span className="relative">{t.label}</span>}
          </button>
        ))}
      </div>
        <motion.div key={current} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }} className="flex-1 overflow-y-auto p-3">
          {P ? <P /> : <DaySummary />}
        </motion.div>
    </div>
  );
}

export function StatusBar() {
  const plugins = useEnabledPlugins().filter((p) => p.status);
  const personas = useApp((s) => s.personas);
  const events = useApp((s) => s.events);
  return (
    <footer className="safe-bottom flex h-[30px] shrink-0 items-center gap-4 overflow-hidden px-3.5 text-[12px] text-muted">
      {plugins.map((p) => {
        const S = p.status!;
        return <S key={p.id} />;
      })}
      <span className="flex-1" />
      <span className="hidden sm:inline">
        {personas.length} personas · {events.length} événements
      </span>
      <SyncBadge />
    </footer>
  );
}

/** Barre d'onglets du bas sur mobile (Android). */
export function MobileNav({ onPanel }: { onPanel: (p: "left" | "right") => void }) {
  const view = useApp((s) => s.settings.view);
  const setSettings = useApp((s) => s.setSettings);
  const views = useViews().slice(0, 4);
  return (
    <nav className="safe-bottom relative flex h-[58px] shrink-0 items-center justify-around border-t border-line bg-panel px-1">
      <button className="flex flex-col items-center gap-0.5 px-2 text-[10.5px] text-muted cursor-pointer" onClick={() => onPanel("left")}>
        <CalendarRange size={19} /> Menu
      </button>
      {views.map((v) => (
        <button key={v.id} onClick={() => setSettings({ view: v.id })} className={clsx("flex flex-col items-center gap-0.5 px-2 text-[10.5px] cursor-pointer", view === v.id ? "text-brand" : "text-muted")}>
          <v.icon size={19} /> {v.label}
        </button>
      ))}
      <button className="flex flex-col items-center gap-0.5 px-2 text-[10.5px] text-muted cursor-pointer" onClick={() => onPanel("right")}>
        <PanelRight size={19} /> Outils
      </button>
      <motion.button
        whileTap={{ scale: 0.9 }}
        className="absolute -top-[68px] right-4 grid place-items-center rounded-2xl bg-brand text-on-brand shadow-xl shadow-brand/30 cursor-pointer"
        style={{ width: 52, height: 52 }}
        onClick={() => newEventAt(new Date(Math.ceil(Date.now() / 3600000) * 3600000))}
        aria-label="Créer"
      >
        <Plus size={24} />
      </motion.button>
    </nav>
  );
}
