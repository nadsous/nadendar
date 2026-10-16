import clsx from "clsx";
import { addDays, addMonths, addWeeks, addYears, endOfMonth, startOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { Factory, Plus, Repeat, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { cap, dayKey, euros, fmt, fromKey, uid } from "../lib/dates";
import type { Money, Persona } from "../lib/types";
import { useApp } from "../store/store";
import { Avatar } from "../components/ui/Avatar";
import { Button, Field, Modal, PersonaSelect } from "../components/ui/ui";
import type { Plugin } from "./types";
import { workedHours } from "./workplan";

export const CATEGORIES_OUT = ["Logement", "Courses", "Transport", "Énergie", "Santé", "École", "Loisirs", "Abonnements", "Impôts", "Autre"];
export const CATEGORIES_IN = ["Salaire", "Prime", "Allocations", "Remboursement", "Autre"];
const CAT_COLORS: Record<string, string> = {
  Logement: "#6366f1", Courses: "#fe7146", Transport: "#38bdf8", Énergie: "#fbbf24", Santé: "#f43f5e",
  École: "#34d399", Loisirs: "#a855f7", Abonnements: "#ec4899", Impôts: "#a1a1aa", Autre: "#71717a",
};

/** Dates d'une ligne (avec répétition) comprises dans [from, to]. */
export function occurrences(m: Money, from: Date, to: Date): Date[] {
  const start = fromKey(m.date);
  if (!m.repeat) return start >= from && start <= to ? [start] : [];
  const out: Date[] = [];
  const step = m.repeat === "mensuel" ? addMonths : m.repeat === "hebdo" ? addWeeks : addYears;
  for (let i = 0, d = start; d <= to && i < 2000; i++, d = step(start, i)) if (d >= from) out.push(d);
  return out;
}

function MoneyModal({ draft, onClose }: { draft: Money | null; onClose: () => void }) {
  const [m, setM] = useState(draft);
  const { add, update, remove, money } = useApp();
  if (draft && m?.id !== draft.id) setM(draft);
  const exists = money.some((x) => x.id === m?.id);
  const cats = m?.type === "revenu" ? CATEGORIES_IN : CATEGORIES_OUT;
  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={m?.type === "revenu" ? "Revenu" : "Dépense"}
      icon={Wallet}
      width={440}
      footer={
        <>
          {exists && (
            <Button variant="danger" icon={Trash2} onClick={() => (remove("money", m!.id), onClose())}>
              Supprimer
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={() => m && ((exists ? update("money", m.id, m) : add("money", m)), onClose())}>
            Enregistrer
          </Button>
        </>
      }
    >
      {m && (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-1.5">
            {(["depense", "revenu"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setM({ ...m, type: t, category: t === "revenu" ? "Salaire" : "Courses" })}
                className={clsx("rounded-lg border py-2 text-[13px] cursor-pointer", m.type === t ? (t === "revenu" ? "border-ok/50 bg-ok/10 text-ok" : "border-bad/50 bg-bad/10 text-bad") : "border-line text-muted")}
              >
                {t === "revenu" ? "Revenu" : "Dépense"}
              </button>
            ))}
          </div>
          <Field label="Libellé">
            <input className="field" autoFocus value={m.label} onChange={(e) => setM({ ...m, label: e.target.value })} placeholder="Loyer, salaire, cantine…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant (€)">
              <input type="number" step="0.01" className="field" value={m.amount || ""} onChange={(e) => setM({ ...m, amount: +e.target.value })} />
            </Field>
            <Field label="Date">
              <input type="date" className="field" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
            </Field>
            <Field label="Catégorie">
              <select className="field" value={m.category} onChange={(e) => setM({ ...m, category: e.target.value })}>
                {cats.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Répéter">
              <select className="field" value={m.repeat ?? ""} onChange={(e) => setM({ ...m, repeat: (e.target.value || undefined) as Money["repeat"] })}>
                <option value="">Une fois</option>
                <option value="mensuel">Chaque mois</option>
                <option value="hebdo">Chaque semaine</option>
                <option value="annuel">Chaque année</option>
              </select>
            </Field>
          </div>
          <Field label="Persona">
            <PersonaSelect value={m.personaId} onChange={(personaId) => setM({ ...m, personaId })} placeholder="Foyer" />
          </Field>
        </div>
      )}
    </Modal>
  );
}

function BudgetView() {
  const cursor = useApp((s) => s.ui.cursor);
  const money = useApp((s) => s.money);
  const personas = useApp((s) => s.personas);
  const patterns = useApp((s) => s.patterns);
  const leaves = useApp((s) => s.leaves);
  const [draft, setDraft] = useState<Money | null>(null);
  const from = startOfMonth(new Date(cursor));
  const to = endOfMonth(from);

  const lines = useMemo(
    () =>
      money
        .flatMap((m) => occurrences(m, from, to).map((d) => ({ m, d })))
        .sort((a, b) => a.d.getTime() - b.d.getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [money, from.getTime()],
  );

  // Salaire estimé : heures du planning × taux horaire, pour qui n'a pas de ligne « Salaire » ce mois-ci.
  const estimated = personas
    .filter((p) => p.hourlyRate && patterns.some((x) => x.personaId === p.id))
    .map((p) => ({ p, hours: workedHours(p.id, from, to, patterns, leaves) }))
    .map((x) => ({ ...x, amount: x.hours * (x.p.hourlyRate ?? 0) }));

  const income = lines.filter((l) => l.m.type === "revenu").reduce((a, l) => a + l.m.amount, 0);
  const spent = lines.filter((l) => l.m.type === "depense").reduce((a, l) => a + l.m.amount, 0);
  const byCat = new Map<string, number>();
  for (const l of lines) if (l.m.type === "depense") byCat.set(l.m.category, (byCat.get(l.m.category) ?? 0) + l.m.amount);
  const maxCat = Math.max(1, ...byCat.values());

  // Solde cumulé jour par jour.
  const curve: number[] = [];
  let acc = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const k = dayKey(d);
    for (const l of lines) if (dayKey(l.d) === k) acc += l.m.type === "revenu" ? l.m.amount : -l.m.amount;
    curve.push(acc);
  }
  const lo = Math.min(0, ...curve);
  const hi = Math.max(1, ...curve);
  const pts = curve.map((v, i) => `${(i / (curve.length - 1)) * 300},${70 - ((v - lo) / (hi - lo)) * 64}`).join(" ");
  const zeroY = 70 - ((0 - lo) / (hi - lo)) * 64;

  const newLine = (type: Money["type"]) =>
    setDraft({ id: uid(), label: "", amount: 0, type, category: type === "revenu" ? "Salaire" : "Courses", date: dayKey(new Date()) });

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto grid max-w-5xl gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[18px] font-semibold text-bright">Budget · {cap(fmt(from, "MMMM yyyy"))}</h2>
          <span className="flex-1" />
          <Button icon={TrendingUp} onClick={() => newLine("revenu")}>
            Revenu
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => newLine("depense")}>
            Dépense
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { l: "Revenus", v: income, c: "text-ok", I: TrendingUp },
            { l: "Dépenses", v: spent, c: "text-bad", I: TrendingDown },
            { l: "Solde", v: income - spent, c: income - spent >= 0 ? "text-bright" : "text-bad", I: Wallet },
          ].map(({ l, v, c, I }, i) => (
            <motion.div key={l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl border border-line bg-base/50 p-3.5">
              <div className="flex items-center gap-1.5 text-[12px] text-muted">
                <I size={14} /> {l}
              </div>
              <div className={clsx("mt-1 text-[24px] font-semibold tabular", c)}>{euros(v)}</div>
            </motion.div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-base/50 p-3.5">
            <div className="mb-2 text-[12px] font-medium text-muted">Solde cumulé du mois</div>
            <svg viewBox="0 0 300 74" className="h-24 w-full" preserveAspectRatio="none">
              <line x1="0" x2="300" y1={zeroY} y2={zeroY} stroke="var(--color-line2)" strokeDasharray="3 3" />
              <motion.polyline initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} points={pts} fill="none" stroke="#fe7146" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className="rounded-xl border border-line bg-base/50 p-3.5">
            <div className="mb-2 text-[12px] font-medium text-muted">Dépenses par catégorie</div>
            <div className="grid gap-1.5">
              {[...byCat].sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                <div key={c} className="grid grid-cols-[92px_1fr_70px] items-center gap-2 text-[12px]">
                  <span className="truncate text-fg">{c}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-elev">
                    <motion.div className="h-full rounded-full" style={{ background: CAT_COLORS[c] ?? "#71717a" }} initial={{ width: 0 }} animate={{ width: `${(v / maxCat) * 100}%` }} />
                  </div>
                  <span className="text-right tabular text-muted">{euros(v)}</span>
                </div>
              ))}
              {!byCat.size && <span className="text-[12px] text-faint">Aucune dépense ce mois-ci.</span>}
            </div>
          </div>
        </div>
        {estimated.length > 0 && (
          <div className="rounded-xl border border-line bg-base/50 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted">
              <Factory size={13} /> Salaire estimé d'après le planning
            </div>
            {estimated.map(({ p, hours, amount }) => (
              <div key={p.id} className="flex items-center gap-2 py-1 text-[13px]">
                <Avatar persona={p} size={22} />
                <span className="flex-1 text-bright">{p.name}</span>
                <span className="text-muted tabular">
                  {Math.round(hours)} h × {p.hourlyRate} €
                </span>
                <span className="w-24 text-right font-medium text-ok tabular">{euros(amount)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-line bg-base/50">
          {lines.map(({ m, d }, i) => {
            const p = personas.find((x) => x.id === m.personaId) as Persona | undefined;
            return (
              <button key={m.id + i} onClick={() => setDraft(m)} className="flex w-full items-center gap-3 border-b border-line px-3.5 py-2 text-left last:border-0 hover:bg-elev/50 cursor-pointer">
                <span className="w-14 text-[12px] text-muted">{fmt(d, "EEE d")}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: m.type === "revenu" ? "#4ade80" : CAT_COLORS[m.category] ?? "#71717a" }} />
                <span className="flex-1 truncate text-[13px] text-bright">{m.label}</span>
                {m.repeat && <Repeat size={12} className="text-faint" />}
                <span className="hidden sm:inline text-[12px] text-faint">{m.category}</span>
                {p && <Avatar persona={p} size={20} />}
                <span className={clsx("w-24 text-right text-[13px] font-medium tabular", m.type === "revenu" ? "text-ok" : "text-fg")}>
                  {m.type === "revenu" ? "+" : "−"}
                  {euros(m.amount)}
                </span>
              </button>
            );
          })}
          {!lines.length && <div className="p-6 text-center text-[13px] text-faint">Ajoute ton salaire, ton loyer, tes abonnements : ils se répètent tout seuls.</div>}
        </div>
      </div>
      <MoneyModal draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function PersonaSection({ persona, onChange }: { persona: Persona; onChange: (p: Partial<Persona>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Métier">
        <input className="field" value={persona.job ?? ""} onChange={(e) => onChange({ job: e.target.value })} placeholder="Opératrice, infirmier…" />
      </Field>
      <Field label="Taux horaire net (€)" hint="Pour estimer le salaire depuis le planning">
        <input type="number" step="0.01" className="field" value={persona.hourlyRate ?? ""} onChange={(e) => onChange({ hourlyRate: e.target.value ? +e.target.value : undefined })} />
      </Field>
    </div>
  );
}

export const budgetPlugin: Plugin = {
  id: "budget",
  name: "Dépenses & salaires",
  tagline: "Revenus et dépenses récurrents, solde du mois, salaire estimé depuis les heures.",
  icon: Wallet,
  color: "#4ade80",
  category: "finances",
  defaultOn: true,
  links: ["workplan", "shopping"],
  badges: (day, s) => {
    let net = 0;
    for (const m of s.money) if (occurrences(m, day, day).length) net += m.type === "revenu" ? m.amount : -m.amount;
    if (!net) return [];
    return [
      {
        id: "money",
        order: 9,
        title: `Budget du jour : ${euros(net)}`,
        node: <span className={clsx("text-[10px] font-medium tabular", net > 0 ? "text-ok" : "text-muted")}>{net > 0 ? "+" : "−"}{Math.abs(Math.round(net))}€</span>,
      },
    ];
  },
  view: { id: "budget", label: "Budget", icon: Wallet, component: BudgetView },
  personaSection: PersonaSection,
};
