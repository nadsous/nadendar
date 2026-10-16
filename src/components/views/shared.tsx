import clsx from "clsx";
import { AlertTriangle, Repeat } from "lucide-react";
import { memo } from "react";
import { hhmm, isoLocal } from "../../lib/dates";
import type { CalItem, DayBadge, PersonaChip } from "../../plugins/types";
import { showPanel, useApp } from "../../store/store";
import { Avatar } from "../ui/Avatar";

export const Badges = memo(function Badges({ badges, max = 4 }: { badges: DayBadge[]; max?: number }) {
  if (!badges.length) return null;
  return (
    <div className="flex min-w-0 items-center justify-end gap-1 overflow-hidden">
      {badges.slice(0, max).map((b) => (
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
      ))}
    </div>
  );
});

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
        "group flex min-w-0 items-center gap-1 rounded-[5px] px-1 transition-colors",
        large ? "py-[3px] text-[12.5px] leading-[18px]" : "py-[1px] text-[11.5px] leading-[16px]",
        onOpen && "cursor-pointer",
        item.allDay ? "text-bright" : "text-fg hover:bg-elev",
      )}
      style={item.allDay ? { background: item.color + "2e", boxShadow: `inset 2px 0 0 ${item.color}` } : undefined}
    >
      {!item.allDay && <span className={clsx("h-[6px] w-[6px] shrink-0 rounded-full", large && "self-start mt-[4px]")} style={{ background: item.color }} />}
      {I && item.allDay && <I size={11} color={item.color} className="shrink-0" />}
      {large && !item.allDay ? (
        // Grande case : l'heure au-dessus, le titre en entier sur deux lignes.
        <span className="flex min-w-0 flex-col">
          <span className="text-[10.5px] leading-[13px] tabular text-muted">
            {hhmm(item.start)}–{hhmm(item.end)}
          </span>
          <span className="line-clamp-2 break-words">{item.title}</span>
        </span>
      ) : (
        <>
          {showTime && !item.allDay && <span className="shrink-0 tabular text-muted">{hhmm(item.start)}</span>}
          <span className={large ? "line-clamp-2 min-w-0 break-words" : "truncate"}>{item.title}</span>
        </>
      )}
      {item.event?.recurrence && <Repeat size={9} className="shrink-0 text-faint" />}
      {item.warning && <AlertTriangle size={10} className="shrink-0 text-bad" />}
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
