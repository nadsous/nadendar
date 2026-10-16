import { filled } from "../../lib/colors";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Repeat } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { hhmm, isoLocal } from "../../lib/dates";
import type { CalItem, DayBadge, PersonaChip } from "../../plugins/types";
import { showPanel, useApp } from "../../store/store";
import { Avatar } from "../ui/Avatar";

/**
 * Index dans un cycle de durées (ms), calé sur l'heure absolue : toutes les cases changent
 * en même temps, sans un minuteur par case qui dériverait.
 */
function useCycleIndex(durations: number[], active: boolean) {
  const total = durations.reduce((a, b) => a + b, 0);
  const at = () => {
    let t = Date.now() % total;
    for (let i = 0; i < durations.length; i++) {
      if (t < durations[i]) return { i, left: durations[i] - t };
      t -= durations[i];
    }
    return { i: 0, left: durations[0] };
  };
  const [idx, setIdx] = useState(() => at().i);
  useEffect(() => {
    if (!active || durations.length < 2) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const { i, left } = at();
      setIdx(i);
      timer = setTimeout(tick, left + 20);
    };
    tick();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, durations.join(",")]);
  return active ? idx : 0;
}

/** Une même place pour plusieurs badges, à tour de rôle (météo 3 s, puis lune 1,5 s). */
function CyclingBadge({ badges }: { badges: DayBadge[] }) {
  const animations = useApp((s) => s.settings.animations);
  const i = useCycleIndex(badges.map((b) => b.cycle ?? 2000), animations);
  const b = badges[Math.min(i, badges.length - 1)];
  return (
    <span className="relative hidden shrink-0 items-center overflow-hidden @[96px]:flex" title={badges.map((x) => x.title).join(" · ")}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={b.id}
          className="flex items-center"
          initial={{ y: 9, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -9, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {b.node}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export const Badges = memo(function Badges({ badges, max = 4 }: { badges: DayBadge[]; max?: number }) {
  if (!badges.length) return null;
  // Les badges « tournants » (météo, lune) occupent une seule place, à la position du premier.
  const cycling = badges.filter((b) => b.cycle);
  const firstCycle = cycling[0]?.id;
  const list = badges.filter((b) => !b.cycle || b.id === firstCycle);
  return (
    <div className="flex min-w-0 items-center justify-end gap-1 overflow-hidden">
      {list.slice(0, max).map((b) =>
        b.id === firstCycle && cycling.length > 1 ? (
          <CyclingBadge key="sky" badges={cycling} />
        ) : (
        // Selon la largeur de la case (@container) : férié toujours (tronqué), météo et lune
        // dès 96 px, le reste (budget, menus, vacances) dès 140 px. Jamais de badge coupé.
        <span
          key={b.id}
          title={b.title}
          className={clsx(
            "items-center",
            b.wide ? "flex min-w-0" : b.order <= 2 ? "hidden shrink-0 @[96px]:flex" : "hidden shrink-0 @[140px]:flex",
          )}
        >
          {b.node}
        </span>
        ),
      )}
    </div>
  );
});

/**
 * Éléments d'une case du mois : si tout ne tient pas, la liste défile seule, un élément à la
 * fois (pause au survol pour pouvoir cliquer).
 */
export function AutoScrollItems({ items, max, onOpen, period = 2600 }: { items: CalItem[]; max: number; onOpen: (i: CalItem) => void; period?: number }) {
  const animations = useApp((s) => s.settings.animations);
  const [hover, setHover] = useState(false);
  const ROW = 20; // 18 px de ligne + 2 px d'écart
  // Hauteur réellement disponible dans la case (mesurée) → nombre de lignes affichables.
  const box = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(max * ROW);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rows = (space: number) => Math.max(1, Math.min(max, Math.floor((space + 2) / ROW)));
  const overflow = items.length > rows(h);
  // En défilement, une bande de 6 px reste libre en bas pour les repères.
  const cap = overflow ? rows(h - 6) : items.length;
  const step = useCycleIndex(overflow ? items.map(() => period) : [period], overflow && animations && !hover);
  const shown = overflow ? Array.from({ length: cap }, (_, k) => items[(step + k) % items.length]) : items;
  return (
    <div
      ref={box}
      className="relative flex min-h-0 flex-1 flex-col gap-[2px] overflow-hidden"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${items.length} éléments — défilement automatique`}
    >
      {!overflow && shown.map((it) => <ItemRow key={it.id} item={it} onOpen={onOpen} />)}
      {overflow && (
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((it) => (
          <motion.div
            key={it.id}
            layout
            initial={{ opacity: 0, y: ROW }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -ROW }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <ItemRow item={it} onOpen={onOpen} />
          </motion.div>
        ))}
      </AnimatePresence>
      )}
      {/* Repère discret : position dans la liste */}
      {overflow && <span className="pointer-events-none absolute bottom-[1px] right-[2px] flex gap-[2px]">
        {items.map((it, k) => (
          <span key={it.id} className={clsx("h-[3px] rounded-full transition-all", k === step % items.length ? "w-2 bg-bright" : "w-[3px] bg-muted/60")} />
        ))}
      </span>}
    </div>
  );
}

/** Pastilles persona : mini avatar + icône du poste (nuit, matin, congé…). */
export const Chips = memo(function Chips({ chips, compact }: { chips: PersonaChip[]; compact?: boolean }) {
  const personas = useApp((s) => s.personas);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-[3px]">
      {chips.map((c) => {
        const p = personas.find((x) => x.id === c.personaId);
        if (!p) return null;
        const I = c.icon;
        return (
          <span
            key={c.id}
            title={`${p.name} — ${c.label}`}
            className="flex items-center gap-[2px] rounded-full py-[1px] pl-[1px] pr-[4px]"
            style={{ background: c.color + "24", boxShadow: `inset 0 0 0 1px ${c.color}40` }}
          >
            <Avatar persona={p} size={compact ? 13 : 15} />
            <I size={compact ? 10 : 11} color={c.color} strokeWidth={2.4} />
          </span>
        );
      })}
    </div>
  );
});

/** Pastilles détaillées : avatar, icône et libellé en clair (cases grandes). */
export const ChipsLabeled = memo(function ChipsLabeled({ chips }: { chips: PersonaChip[] }) {
  const personas = useApp((s) => s.personas);
  if (!chips.length) return null;
  return (
    <div className="flex flex-col gap-[3px]">
      {chips.map((c) => {
        const p = personas.find((x) => x.id === c.personaId);
        if (!p) return null;
        const I = c.icon;
        return (
          <span
            key={c.id}
            title={`${p.name} — ${c.label}`}
            className="flex min-w-0 items-start gap-1.5 rounded-md py-[2px] pl-[2px] pr-1.5 text-[11.5px] leading-[15px]"
            style={{ background: c.color + "1e", color: c.color }}
          >
            <Avatar persona={p} size={16} />
            <I size={12} strokeWidth={2.3} className="mt-[1.5px] shrink-0" />
            {/* L'avatar dit qui ; le texte dit quoi, sur deux lignes au besoin. */}
            <span className="line-clamp-2 min-w-0 break-words">{c.label}</span>
          </span>
        );
      })}
    </div>
  );
});

/** Ligne d'élément dans une case du mois / un agenda. */
export function ItemRow({ item, onOpen, showTime = true, large }: { item: CalItem; onOpen?: (i: CalItem) => void; showTime?: boolean; large?: boolean }) {
  const personas = useApp((s) => s.personas);
  const I = item.icon;
  const p = personas.find((x) => x.id === item.personaIds[0]);
  const draggable = !!item.event && !item.event.recurrence;
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/nadendar-event", item.event!.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.(item);
      }}
      title={`${item.title}${item.allDay ? "" : ` · ${hhmm(item.start)}–${hhmm(item.end)}`}${item.warning ? `\n⚠ ${item.warning}` : ""}`}
      className={clsx(
        "group flex min-w-0 items-center gap-1 rounded-[5px] px-1.5 font-medium transition-[filter] hover:brightness-110",
        large ? "py-[3px] text-[12.5px] leading-[18px]" : "py-[1px] text-[11.5px] leading-[16px]",
        onOpen && "cursor-pointer",
      )}
      // Encadré entièrement rempli de la couleur de l'élément (pas de liseré).
      style={filled(item.color)}
    >
      {I && <I size={11} className={clsx("shrink-0", large && !item.allDay && "self-start mt-[3px]")} />}
      {large && !item.allDay ? (
        // Grande case : l'heure au-dessus, le titre en entier sur deux lignes.
        <span className="flex min-w-0 flex-col">
          <span className="text-[10.5px] font-normal leading-[13px] tabular opacity-80">
            {hhmm(item.start)}–{hhmm(item.end)}
          </span>
          <span className="line-clamp-2 break-words">{item.title}</span>
        </span>
      ) : (
        <>
          {showTime && !item.allDay && <span className="shrink-0 font-normal tabular opacity-80">{hhmm(item.start)}</span>}
          <span className={large ? "line-clamp-2 min-w-0 break-words" : "truncate"}>{item.title}</span>
        </>
      )}
      {item.event?.recurrence && <Repeat size={9} className="shrink-0 opacity-70" />}
      {item.warning && <AlertTriangle size={10} strokeWidth={2.6} className="shrink-0" />}
      {p && item.personaIds.length > 0 && !item.allDay && (
        <span className="ml-auto hidden xl:block">
          <Avatar persona={p} size={13} />
        </span>
      )}
    </div>
  );
}

/** Ouvre l'éditeur sur l'élément (événement) ou sur sa source. */
export function openItem(item: CalItem) {
  const ui = useApp.getState().setUI;
  if (item.event) {
    ui({ editingEvent: item.event });
    return;
  }
  const settings = useApp.getState().setSettings;
  if (item.source === "workplan") {
    const p = useApp.getState().personas.find((x) => x.id === item.personaIds[0]);
    if (p) ui({ editingPersona: p });
  } else if (item.source === "school") {
    const p = useApp.getState().personas.find((x) => x.id === item.personaIds[0]);
    if (p) ui({ editingPersona: p });
  } else if (item.source === "gantt") settings({ view: "gantt" });
  else if (["todo", "shopping", "deliveries"].includes(item.source)) showPanel("right", item.source);
  else if (item.source === "birthdays") {
    const p = useApp.getState().personas.find((x) => x.id === item.personaIds[0]);
    if (p) ui({ editingPersona: p });
  }
}

export function newEventAt(start: Date, allDay = false, minutes = 60) {
  const end = allDay ? start : new Date(start.getTime() + minutes * 60000);
  useApp.getState().setUI({
    editingEvent: { title: "", kind: "event", start: isoLocal(start), end: isoLocal(end), allDay, personaIds: [] },
  });
}
