import { addDays, addMonths, endOfMonth, isSameMonth, isWeekend, startOfMonth, startOfWeek } from "date-fns";
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import logo from "../../assets/logo.svg";
import { cap, dayKey, fmt, hhmm, monthGrid, WEEK } from "../../lib/dates";
import { holidayOn } from "../../lib/holidays";
import { filled } from "../../lib/colors";
import { LEAVE_TYPES, SHIFT_TYPES, workOn } from "../../lib/work";
import { LEAVE_ICONS, SHIFT_ICONS } from "../ui/icons";
import type { LeaveType } from "../../lib/types";
import { collectChips, collectItems, isOn, pluginById } from "../../plugins/registry";
import type { CalItem, Plugin } from "../../plugins/types";
import { workedHours, workIcon } from "../../plugins/workplan";
import type { AppState } from "../../store/store";
import { AvatarSvg } from "../ui/Avatar";

// Pages A4 paysage de taille fixe (96 dpi) : chaque case a une hauteur calculée,
// le contenu qui ne tient pas est résumé en « +N », rien n'est jamais coupé.
export const PAGE_W = 1123;
export const PAGE_H = 794;
const PAD = 30;

export type PrintKind = "month" | "week" | "planning";

export interface PrintOptions {
  kind: PrintKind;
  /** Premier mois / première semaine imprimé(e). */
  from: number;
  count: number;
  personaIds: string[];
  dark: boolean;
  showChips: boolean;
}

interface Theme {
  bg: string;
  cell: string;
  cellOut: string;
  cellWeekend: string;
  line: string;
  text: string;
  muted: string;
  faint: string;
}

const LIGHT: Theme = { bg: "#ffffff", cell: "#ffffff", cellOut: "#f6f6f7", cellWeekend: "#fafafa", line: "#dcdce0", text: "#18181b", muted: "#6b6b75", faint: "#a1a1aa" };
const DARK: Theme = { bg: "#111113", cell: "#1b1b1e", cellOut: "#151517", cellWeekend: "#18181b", line: "#2c2c31", text: "#f4f4f5", muted: "#8b8b95", faint: "#5b5b64" };
const BRAND = "#fe7146";

/** État filtré : seules les personas choisies sont imprimées. */
function filtered(s: AppState, ids: string[]): AppState {
  const keep = new Set(ids);
  return { ...s, personas: s.personas.map((p) => ({ ...p, hidden: !keep.has(p.id) })) };
}

function Page({ t, title, subtitle, children }: { t: Theme; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div
      className="print-page"
      style={{
        width: PAGE_W,
        height: PAGE_H,
        padding: PAD,
        background: t.bg,
        color: t.text,
        fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
        letterSpacing: "-0.01em",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 12, height: 44, marginBottom: 10 }}>
        <img src={logo} width={34} height={34} alt="" style={{ borderRadius: 8 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 650, lineHeight: 1.1 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: t.muted }}>{subtitle}</div>}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          Nad<span style={{ color: BRAND }}>endar</span>
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

function Legend({ s, t }: { s: AppState; t: Theme }) {
  const people = s.personas.filter((p) => !p.hidden);
  if (!people.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 10.5, color: t.muted }}>
      {people.map((p) => (
        <span key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <AvatarSvg spec={p.avatar} color={p.color} size={14} /> {p.name}
        </span>
      ))}
    </div>
  );
}

function Chip({ s, personaId, item }: { s: AppState; personaId: string; item: { icon: Plugin["icon"]; color: string; label: string } }) {
  const p = s.personas.find((x) => x.id === personaId);
  if (!p) return null;
  const I = item.icon;
  return (
    <span title={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 1, borderRadius: 99, padding: "0 3px 0 1px", background: item.color + "2a" }}>
      <AvatarSvg spec={p.avatar} color={p.color} size={12} />
      <I size={9} color={item.color} strokeWidth={2.6} />
    </span>
  );
}

function ItemLine({ it }: { it: CalItem; t?: Theme }) {
  const base: CSSProperties = { display: "flex", alignItems: "center", gap: 3, height: 13, fontSize: 9.5, lineHeight: "13px", overflow: "hidden", whiteSpace: "nowrap", borderRadius: 3 };
  // Encadré plein, comme à l'écran.
  return (
    <div style={{ ...base, padding: "0 4px", fontWeight: 500, ...filled(it.color) }}>
      {!it.allDay && <span style={{ opacity: 0.8, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{hhmm(it.start)}</span>}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</span>
    </div>
  );
}

function perDay(items: CalItem[], to: Date) {
  const map = new Map<string, CalItem[]>();
  for (const it of items) {
    if (it.subtle) continue;
    if (it.allDay) {
      for (let d = new Date(it.start); d <= it.end && d < to; d = addDays(d, 1)) map.set(dayKey(d), [...(map.get(dayKey(d)) ?? []), it]);
    } else map.set(dayKey(it.start), [...(map.get(dayKey(it.start)) ?? []), it]);
  }
  return map;
}

function MonthPage({ s, plugins, anchor, opts, t }: { s: AppState; plugins: Plugin[]; anchor: Date; opts: PrintOptions; t: Theme }) {
  const days = monthGrid(anchor).slice(0, 42);
  const to = addDays(days[days.length - 1], 1);
  // 6 semaines même si le mois en tient en 5 : la grille garde toujours la même géométrie.
  const weeks = days.length / 7;
  const items = collectItems(days[0], to, s, plugins);
  const map = perDay(items, to);
  const gridH = PAGE_H - PAD * 2 - 54 - 20 - 26;
  const cellH = Math.floor(gridH / weeks);
  const maxLines = Math.max(1, Math.floor((cellH - (opts.showChips ? 38 : 24)) / 14));

  return (
    <Page t={t} title={cap(fmt(anchor, "MMMM yyyy"))} subtitle={`${s.personas.filter((p) => !p.hidden).length} personas`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", height: 20, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: t.muted }}>
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} style={{ textAlign: "center" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `repeat(${weeks}, ${cellH}px)`, border: `1px solid ${t.line}`, borderRadius: 8, overflow: "hidden" }}>
        {days.map((d, i) => {
          const k = dayKey(d);
          const list = map.get(k) ?? [];
          const out = !isSameMonth(d, anchor);
          const hol = holidayOn(d);
          const chips = opts.showChips ? collectChips(d, s, plugins) : [];
          const shown = list.length > maxLines ? list.slice(0, maxLines - 1) : list;
          return (
            <div
              key={k}
              className="print-cell"
              style={{
                padding: 4,
                overflow: "hidden",
                background: out ? t.cellOut : isWeekend(d) || hol ? t.cellWeekend : t.cell,
                borderRight: i % 7 < 6 ? `1px solid ${t.line}` : undefined,
                borderBottom: i < days.length - 7 ? `1px solid ${t.line}` : undefined,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4, height: 16 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: out ? t.faint : t.text }}>{d.getDate()}</span>
                {hol && <span style={{ fontSize: 8.5, color: "#e11d48", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{hol}</span>}
              </div>
              {chips.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 2, maxHeight: 14, overflow: "hidden" }}>
                  {chips.map((c) => (
                    <Chip key={c.id} s={s} personaId={c.personaId} item={c} />
                  ))}
                </div>
              )}
              {shown.map((it) => (
                <ItemLine key={it.id} it={it} t={t} />
              ))}
              {shown.length < list.length && <div style={{ fontSize: 9, color: t.muted, height: 12 }}>+{list.length - shown.length} autres</div>}
            </div>
          );
        })}
      </div>
      <Legend s={s} t={t} />
    </Page>
  );
}

function WeekPage({ s, plugins, monday, opts, t }: { s: AppState; plugins: Plugin[]; monday: Date; opts: PrintOptions; t: Theme }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const to = addDays(monday, 7);
  const items = collectItems(monday, to, s, plugins);
  const map = perDay(items, to);
  const sunday = days[6];
  const colH = PAGE_H - PAD * 2 - 54 - 26;
  const maxLines = Math.floor((colH - 70) / 30);
  return (
    <Page t={t} title={`Semaine du ${fmt(monday, "d")} au ${fmt(sunday, "d MMMM yyyy")}`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", height: colH, border: `1px solid ${t.line}`, borderRadius: 8, overflow: "hidden" }}>
        {days.map((d, i) => {
          const list = map.get(dayKey(d)) ?? [];
          const chips = opts.showChips ? collectChips(d, s, plugins) : [];
          const hol = holidayOn(d);
          const shown = list.length > maxLines ? list.slice(0, maxLines - 1) : list;
          return (
            <div key={i} className="print-cell" style={{ padding: 8, overflow: "hidden", background: isWeekend(d) ? t.cellWeekend : t.cell, borderRight: i < 6 ? `1px solid ${t.line}` : undefined, display: "flex", flexDirection: "column", gap: 5 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: t.muted }}>{fmt(d, "EEEE")}</div>
                <div style={{ fontSize: 20, fontWeight: 650 }}>{d.getDate()}</div>
                {hol && <div style={{ fontSize: 9.5, color: "#e11d48" }}>{hol}</div>}
              </div>
              {chips.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {chips.map((c) => {
                    const p = s.personas.find((x) => x.id === c.personaId);
                    const I = c.icon;
                    return p ? (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, color: c.color, whiteSpace: "nowrap", overflow: "hidden" }}>
                        <AvatarSvg spec={p.avatar} color={p.color} size={13} />
                        <I size={10} color={c.color} strokeWidth={2.4} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              {shown.map((it) => (
                <div key={it.id} style={{ ...filled(it.color), borderRadius: 4, padding: "3px 6px", fontSize: 10, lineHeight: 1.25, height: 26, overflow: "hidden" }}>
                  <div style={{ fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{it.title}</div>
                  <div style={{ opacity: 0.8, fontSize: 9 }}>{it.allDay ? "Journée" : `${hhmm(it.start)}–${hhmm(it.end)}`}</div>
                </div>
              ))}
              {shown.length < list.length && <div style={{ fontSize: 9.5, color: t.muted }}>+{list.length - shown.length} autres</div>}
            </div>
          );
        })}
      </div>
      <Legend s={s} t={t} />
    </Page>
  );
}

function PlanningPage({ s, anchor, t }: { s: AppState; anchor: Date; t: Theme }) {
  const days: Date[] = [];
  for (let d = startOfMonth(anchor); d <= endOfMonth(anchor); d = addDays(d, 1)) days.push(d);
  const workers = s.personas.filter((p) => !p.hidden && (s.patterns.some((x) => x.personaId === p.id) || s.leaves.some((l) => l.personaId === p.id)));
  const nameW = 150;
  const hoursW = 48;
  const colW = Math.floor((PAGE_W - PAD * 2 - nameW - hoursW) / days.length);
  return (
    <Page t={t} title={`Planning de travail · ${cap(fmt(anchor, "MMMM yyyy"))}`}>
      <div style={{ display: "flex", fontSize: 9.5, color: t.muted, height: 34, alignItems: "flex-end", paddingBottom: 4 }}>
        <div style={{ width: nameW }} />
        {days.map((d) => (
          <div key={d.getTime()} style={{ width: colW, textAlign: "center", color: holidayOn(d) ? "#e11d48" : isWeekend(d) ? t.faint : t.muted }}>
            <div style={{ textTransform: "uppercase", fontSize: 8 }}>{fmt(d, "EEEEE")}</div>
            <div style={{ fontWeight: 600, color: t.text }}>{d.getDate()}</div>
          </div>
        ))}
        <div style={{ width: hoursW, textAlign: "right" }}>Heures</div>
      </div>
      {workers.map((p) => (
        <div key={p.id} className="print-cell" style={{ display: "flex", alignItems: "center", height: 34, borderTop: `1px solid ${t.line}` }}>
          <div style={{ width: nameW, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
            <AvatarSvg spec={p.avatar} color={p.color} size={22} /> {p.name}
          </div>
          {days.map((d) => {
            const w = workOn(p.id, d, s.patterns, s.leaves);
            const info = w && workIcon(w);
            const I = info?.icon;
            return (
              <div key={d.getTime()} style={{ width: colW, display: "flex", justifyContent: "center" }}>
                <div style={{ width: colW - 4, height: 24, borderRadius: 5, display: "grid", placeItems: "center", background: info ? info.color + "2a" : undefined, opacity: w?.shift?.off && !w.leave ? 0.45 : 1 }}>
                  {I && <I size={12} color={info!.color} strokeWidth={2.3} />}
                </div>
              </div>
            );
          })}
          <div style={{ width: hoursW, textAlign: "right", fontSize: 11, fontWeight: 600 }}>{Math.round(workedHours(p.id, days[0], days[days.length - 1], s.patterns, s.leaves))} h</div>
        </div>
      ))}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14, paddingTop: 10, borderTop: `1px solid ${t.line}`, fontSize: 10.5, color: t.muted }}>
        {SHIFT_TYPES.filter((x) => !x.code.endsWith("12")).map((x) => {
          const I = SHIFT_ICONS[x.icon];
          return (
            <span key={x.code} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <I size={12} color={x.color} strokeWidth={2.3} /> {x.label}
              {!x.off && <span style={{ color: t.faint }}>{x.start}–{x.end}</span>}
            </span>
          );
        })}
        {(Object.keys(LEAVE_TYPES) as LeaveType[]).map((k) => {
          const I = LEAVE_ICONS[k];
          return (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <I size={12} color={LEAVE_TYPES[k].color} strokeWidth={2.3} /> {LEAVE_TYPES[k].label}
            </span>
          );
        })}
      </div>
      {!workers.length && <div style={{ color: t.muted, fontSize: 13, padding: 20 }}>Aucun planning de travail pour les personas choisies.</div>}
    </Page>
  );
}

/** Toutes les pages, dans l'ordre. */
export const PrintSheet = forwardRef<HTMLDivElement, { s: AppState; opts: PrintOptions }>(function PrintSheet({ s, opts }, ref) {
  const t = opts.dark ? DARK : LIGHT;
  const state = filtered(s, opts.personaIds);
  const plugins = [...pluginById.values()].filter((p) => isOn(s, p));
  const pages: ReactNode[] = [];
  for (let i = 0; i < opts.count; i++) {
    if (opts.kind === "week") {
      const monday = addDays(startOfWeek(new Date(opts.from), WEEK), i * 7);
      pages.push(<WeekPage key={i} s={state} plugins={plugins} monday={monday} opts={opts} t={t} />);
    } else {
      const anchor = addMonths(startOfMonth(new Date(opts.from)), i);
      pages.push(
        opts.kind === "planning" ? (
          <PlanningPage key={i} s={state} anchor={anchor} t={t} />
        ) : (
          <MonthPage key={i} s={state} plugins={plugins} anchor={anchor} opts={opts} t={t} />
        ),
      );
    }
  }
  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {pages}
    </div>
  );
});
