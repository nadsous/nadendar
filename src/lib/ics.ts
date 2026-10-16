// Lecture et écriture du format iCalendar (.ics) : Google Agenda, Outlook, Apple, etc.
import { addDays, addMonths, addWeeks, addYears, format } from "date-fns";
import { dayKey, isoLocal } from "./dates";
import type { CalEvent, MeetingProvider, Recurrence } from "./types";

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface Component {
  type: string;
  props: Prop[];
  children: Component[];
}

/** Déplie les lignes (RFC 5545 §3.1) puis construit l'arbre BEGIN/END. */
function parseTree(text: string): Component {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const root: Component = { type: "ROOT", props: [], children: [] };
  const stack = [root];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const colon = findColon(raw);
    if (colon < 0) continue;
    const left = raw.slice(0, colon);
    const value = raw.slice(colon + 1);
    const [name, ...paramParts] = left.split(";");
    const upper = name.toUpperCase();
    if (upper === "BEGIN") {
      const c: Component = { type: value.trim().toUpperCase(), props: [], children: [] };
      stack[stack.length - 1].children.push(c);
      stack.push(c);
      continue;
    }
    if (upper === "END") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const eq = p.indexOf("=");
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
    }
    stack[stack.length - 1].props.push({ name: upper, params, value });
  }
  return root;
}

/** Premier « : » hors guillemets (les paramètres peuvent en contenir). */
function findColon(s: string) {
  let q = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') q = !q;
    else if (s[i] === ":" && !q) return i;
  }
  return -1;
}

const unescape = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
const get = (c: Component, name: string) => c.props.find((p) => p.name === name);
const all = (c: Component, name: string) => c.props.filter((p) => p.name === name);

// Noms de fuseaux Windows (Outlook) → noms IANA connus d'Intl.
const WINDOWS_TZ: Record<string, string> = {
  "Romance Standard Time": "Europe/Paris",
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw",
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "E. Europe Standard Time": "Europe/Bucharest",
  "Morocco Standard Time": "Africa/Casablanca",
  "W. Central Africa Standard Time": "Africa/Lagos",
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Pacific Standard Time": "America/Los_Angeles",
  "UTC": "UTC",
};

/** Décalage (ms) du fuseau `tz` à l'instant `utc`. */
function tzOffset(utc: number, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - utc;
}

/** Heure « murale » d'un fuseau → instant absolu. */
function zonedToDate(y: number, mo: number, d: number, h: number, mi: number, s: number, tzRaw: string): Date {
  const tz = WINDOWS_TZ[tzRaw] ?? tzRaw;
  const guess = Date.UTC(y, mo, d, h, mi, s);
  try {
    const off1 = tzOffset(guess, tz);
    const off2 = tzOffset(guess - off1, tz);
    return new Date(guess - off2);
  } catch {
    // Fuseau inconnu : on garde l'heure telle quelle, en heure locale.
    return new Date(y, mo, d, h, mi, s);
  }
}

/** Valeur DATE ou DATE-TIME → Date + journée entière ? */
function parseWhen(p: Prop | undefined): { date: Date; allDay: boolean } | null {
  if (!p) return null;
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, Y, M, D, h, mi, s, z] = m;
  if (!h || p.params.VALUE === "DATE") return { date: new Date(+Y, +M - 1, +D), allDay: true };
  if (z) return { date: new Date(Date.UTC(+Y, +M - 1, +D, +h, +mi, +(s ?? 0))), allDay: false };
  if (p.params.TZID) return { date: zonedToDate(+Y, +M - 1, +D, +h, +mi, +(s ?? 0), p.params.TZID), allDay: false };
  return { date: new Date(+Y, +M - 1, +D, +h, +mi, +(s ?? 0)), allDay: false };
}

const DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

function parseRRule(value: string, start: Date): Recurrence | undefined {
  const r = Object.fromEntries(value.split(";").map((kv) => kv.split("=") as [string, string]));
  const FREQS: Record<string, Recurrence["freq"]> = { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", YEARLY: "yearly" };
  const freq = FREQS[r.FREQ];
  if (!freq) return undefined;
  const interval = Math.max(1, +(r.INTERVAL ?? 1));
  const rec: Recurrence = { freq, interval };
  if (freq === "weekly" && r.BYDAY) {
    const days = r.BYDAY.split(",").map((d) => DAYS.indexOf(d.replace(/^[+-]?\d+/, "")) + 1).filter((n) => n > 0);
    if (days.length) rec.byWeekday = [...new Set(days)].sort();
  }
  if (r.UNTIL) {
    const u = parseWhen({ name: "UNTIL", params: {}, value: r.UNTIL });
    if (u) rec.until = dayKey(u.date);
  } else if (r.COUNT) {
    // COUNT → date de fin approchée (suffisant pour l'affichage).
    const n = Math.max(1, +r.COUNT) - 1;
    let end = start;
    if (freq === "daily") end = addDays(start, n * interval);
    else if (freq === "weekly") end = addWeeks(start, Math.ceil((n + 1) / (rec.byWeekday?.length ?? 1)) * interval);
    else if (freq === "monthly") end = addMonths(start, n * interval);
    else end = addYears(start, n * interval);
    rec.until = dayKey(freq === "weekly" ? addDays(end, -1) : end);
  }
  return rec;
}

/** Durée d'un TRIGGER de rappel (-PT10M, -PT1H, -P1D…) en minutes avant. */
function triggerMinutes(v: string): number | undefined {
  const m = v.match(/^-?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return undefined;
  const [, w, d, h, mi] = m;
  return (+(w ?? 0)) * 10080 + (+(d ?? 0)) * 1440 + (+(h ?? 0)) * 60 + (+(mi ?? 0));
}

const LINK = /https?:\/\/[^\s"<>]+/g;

function meetingFrom(text: string, conf?: string): { provider: MeetingProvider; url: string } | undefined {
  const links = [conf, ...(text.match(LINK) ?? [])].filter(Boolean) as string[];
  for (const url of links) {
    const u = url.toLowerCase();
    if (u.includes("meet.google")) return { provider: "meet", url };
    if (u.includes("teams.microsoft") || u.includes("teams.live")) return { provider: "teams", url };
    if (u.includes("zoom.us")) return { provider: "zoom", url };
    if (u.includes("doctolib")) return { provider: "doctolib", url };
  }
  return undefined;
}

export interface IcsResult {
  name?: string;
  events: (Omit<CalEvent, "id"> & { uid: string })[];
}

/** Lit un fichier .ics et renvoie des événements au format Nadendar. */
export function parseIcs(text: string): IcsResult {
  const root = parseTree(text);
  const cal = root.children.find((c) => c.type === "VCALENDAR") ?? root;
  const name = get(cal, "X-WR-CALNAME")?.value;
  const out: IcsResult["events"] = [];
  const masters = new Map<string, IcsResult["events"][number]>();
  const overrides: { uid: string; rid: Date }[] = [];

  for (const ve of cal.children.filter((c) => c.type === "VEVENT")) {
    if (get(ve, "STATUS")?.value.toUpperCase() === "CANCELLED") continue;
    const st = parseWhen(get(ve, "DTSTART"));
    if (!st) continue;
    let en = parseWhen(get(ve, "DTEND"));
    const dur = get(ve, "DURATION")?.value;
    if (!en && dur) {
      const mins = triggerMinutes(dur.replace(/^\+/, "-")) ?? 60;
      en = { date: new Date(st.date.getTime() + mins * 60000), allDay: st.allDay };
    }
    if (!en) en = { date: st.allDay ? addDays(st.date, 1) : new Date(st.date.getTime() + 3600000), allDay: st.allDay };

    const uid = get(ve, "UID")?.value ?? `${st.date.getTime()}-${Math.random().toString(36).slice(2)}`;
    const title = unescape(get(ve, "SUMMARY")?.value ?? "(sans titre)");
    const description = unescape(get(ve, "DESCRIPTION")?.value ?? "");
    const location = unescape(get(ve, "LOCATION")?.value ?? "");
    const conf = get(ve, "X-GOOGLE-CONFERENCE")?.value ?? get(ve, "URL")?.value;
    const meeting = meetingFrom(`${description}\n${location}`, conf);
    const alarm = ve.children.find((c) => c.type === "VALARM");
    const reminder = alarm ? triggerMinutes(get(alarm, "TRIGGER")?.value ?? "") : undefined;
    const rid = parseWhen(get(ve, "RECURRENCE-ID"));

    // Journée entière : DTEND est exclusif en iCal, inclusif chez nous.
    const endDate = st.allDay ? addDays(en.date, -1) : en.date;
    const ev: IcsResult["events"][number] = {
      uid: rid ? `${uid}#${rid.date.getTime()}` : uid,
      title,
      start: st.allDay ? `${dayKey(st.date)}T00:00` : isoLocal(st.date),
      end: st.allDay ? `${dayKey(endDate < st.date ? st.date : endDate)}T00:00` : isoLocal(endDate),
      allDay: st.allDay,
      kind: meeting ? "meeting" : "event",
      personaIds: [],
      location: location || undefined,
      notes: description || undefined,
      meeting,
      reminderMin: reminder,
    };
    const rrule = get(ve, "RRULE")?.value;
    if (rrule && !rid) {
      ev.recurrence = parseRRule(rrule, st.date);
      const ex = all(ve, "EXDATE").flatMap((p) => p.value.split(",").map((v) => parseWhen({ ...p, value: v })));
      if (ev.recurrence && ex.length) ev.recurrence.exdates = ex.filter(Boolean).map((x) => dayKey(x!.date));
    }
    if (rid) overrides.push({ uid, rid: rid.date });
    else masters.set(uid, ev);
    out.push(ev);
  }
  // Une occurrence modifiée remplace celle de la série : on l'exclut de la série.
  for (const o of overrides) {
    const m = masters.get(o.uid);
    if (m?.recurrence) m.recurrence.exdates = [...(m.recurrence.exdates ?? []), dayKey(o.rid)];
  }
  return { name, events: out };
}

// ── Export ───────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const utc = (d: Date) => format(new Date(d.getTime() + d.getTimezoneOffset() * 60000), "yyyyMMdd'T'HHmmss'Z'");

/** Replie les lignes à 75 octets (approximé en caractères). */
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");

export function toIcs(events: CalEvent[], calName = "Nadendar"): string {
  const L: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nads//Nadendar//FR", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(calName)}`];
  const stamp = utc(new Date());
  for (const e of events) {
    const s = new Date(e.start);
    const en = new Date(e.end);
    L.push("BEGIN:VEVENT", `UID:${e.id}@nadendar`, `DTSTAMP:${stamp}`);
    if (e.allDay) {
      L.push(`DTSTART;VALUE=DATE:${format(s, "yyyyMMdd")}`, `DTEND;VALUE=DATE:${format(addDays(en, 1), "yyyyMMdd")}`);
    } else {
      L.push(`DTSTART:${utc(s)}`, `DTEND:${utc(en)}`);
    }
    L.push(`SUMMARY:${esc(e.title || "(sans titre)")}`);
    if (e.location) L.push(`LOCATION:${esc(e.location)}`);
    const desc = [e.notes, e.meeting?.url].filter(Boolean).join("\n");
    if (desc) L.push(`DESCRIPTION:${esc(desc)}`);
    if (e.meeting?.url) L.push(`URL:${e.meeting.url}`);
    const r = e.recurrence;
    if (r) {
      const parts = [`FREQ=${r.freq.toUpperCase()}`, `INTERVAL=${r.interval}`];
      if (r.freq === "weekly" && r.byWeekday?.length) parts.push(`BYDAY=${r.byWeekday.map((d) => DAYS[d - 1]).join(",")}`);
      if (r.until) parts.push(`UNTIL=${r.until.replace(/-/g, "")}T235959Z`);
      L.push(`RRULE:${parts.join(";")}`);
      for (const x of r.exdates ?? []) L.push(e.allDay ? `EXDATE;VALUE=DATE:${x.replace(/-/g, "")}` : `EXDATE:${utc(new Date(`${x}T${e.start.slice(11, 16)}`))}`);
    }
    if (e.reminderMin !== undefined) L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${e.reminderMin}M`, "END:VALARM");
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
