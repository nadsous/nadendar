import clsx from "clsx";
import { AlertTriangle, ExternalLink, Package, PackageCheck, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { atTime, dayKey, fmt, fromKey, uid } from "../lib/dates";
import { openExternal } from "../lib/platform";
import type { Delivery, DeliveryStatus, Persona } from "../lib/types";
import { shiftInterval, workOn } from "../lib/work";
import { useApp, type AppState } from "../store/store";
import { Avatar } from "../components/ui/Avatar";
import { Button, Empty, Field, Modal, PersonaSelect } from "../components/ui/ui";
import type { CalItem, Plugin } from "./types";

const CARRIERS: Record<string, (t: string) => string> = {
  Colissimo: (t) => `https://www.laposte.fr/outils/suivre-vos-envois?code=${t}`,
  Chronopost: (t) => `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${t}`,
  "Mondial Relay": (t) => `https://www.mondialrelay.fr/suivi-de-colis/?NumeroExpedition=${t}`,
  UPS: (t) => `https://www.ups.com/track?tracknum=${t}`,
  DHL: (t) => `https://www.dhl.com/fr-fr/home/tracking.html?tracking-id=${t}`,
  DPD: (t) => `https://trace.dpd.fr/fr/trace/${t}`,
  "Amazon": () => `https://www.amazon.fr/gp/your-account/order-history`,
  GLS: (t) => `https://gls-group.com/FR/fr/suivi-colis?match=${t}`,
  Autre: () => "",
};

const STATUS: Record<DeliveryStatus, { label: string; color: string }> = {
  attendue: { label: "Attendue", color: "#fbbf24" },
  "en-route": { label: "En route", color: "#38bdf8" },
  livree: { label: "Livrée", color: "#4ade80" },
  probleme: { label: "Problème", color: "#f87171" },
};

/** Qui est disponible sur le créneau ? Croise le planning de travail et l'école. */
export function availability(d: Delivery, s: Pick<AppState, "personas" | "patterns" | "leaves">) {
  const day = fromKey(d.date);
  const a = atTime(day, d.slotStart);
  const b = atTime(day, d.slotEnd);
  return s.personas
    .filter((p) => p.role !== "bebe" && p.role !== "enfant")
    .map((p) => {
      let busy: string | null = null;
      for (const off of [-1, 0]) {
        const dd = new Date(day);
        dd.setDate(dd.getDate() + off);
        const w = workOn(p.id, dd, s.patterns, s.leaves);
        if (w?.shift && !w.leave) {
          const iv = shiftInterval(dd, w.shift);
          if (iv && iv[0] < b && iv[1] > a) busy = `${w.shift.label} ${w.shift.start}–${w.shift.end}`;
        }
      }
      return { p, busy };
    });
}

function DeliveryModal({ draft, onClose }: { draft: Delivery | null; onClose: () => void }) {
  const [d, setD] = useState<Delivery | null>(draft);
  const state = useApp();
  if (draft && d?.id !== draft.id) setD(draft);
  const exists = !!state.deliveries.find((x) => x.id === d?.id);
  const avail = d ? availability(d, state) : [];
  const save = () => {
    if (!d) return;
    if (exists) state.update("deliveries", d.id, d);
    else state.add("deliveries", d);
    onClose();
  };
  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={exists ? "Livraison" : "Nouvelle livraison"}
      icon={Package}
      width={480}
      footer={
        <>
          {exists && (
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                state.remove("deliveries", d!.id);
                onClose();
              }}
            >
              Supprimer
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save}>
            Enregistrer
          </Button>
        </>
      }
    >
      {d && (
        <div className="grid gap-3">
          <Field label="Colis">
            <input className="field" autoFocus value={d.title} placeholder="Chaussures, commande Fnac…" onChange={(e) => setD({ ...d, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Transporteur">
              <select className="field" value={d.carrier} onChange={(e) => setD({ ...d, carrier: e.target.value })}>
                {Object.keys(CARRIERS).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="N° de suivi">
              <input className="field" value={d.tracking ?? ""} onChange={(e) => setD({ ...d, tracking: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Jour">
              <input type="date" className="field" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
            </Field>
            <Field label="Entre">
              <input type="time" className="field" value={d.slotStart} onChange={(e) => setD({ ...d, slotStart: e.target.value })} />
            </Field>
            <Field label="Et">
              <input type="time" className="field" value={d.slotEnd} onChange={(e) => setD({ ...d, slotEnd: e.target.value })} />
            </Field>
          </div>
          <Field label="Point relais (optionnel)">
            <input className="field" value={d.relay ?? ""} placeholder="Tabac de la gare…" onChange={(e) => setD({ ...d, relay: e.target.value })} />
          </Field>
          <Field label="Qui récupère le colis ?">
            <PersonaSelect value={d.personaId} onChange={(personaId) => setD({ ...d, personaId })} placeholder="Personne" />
          </Field>
          {avail.length > 0 && (
            <div className="grid gap-1">
              <span className="text-[11.5px] text-muted">Disponibilités sur le créneau (d'après les plannings) :</span>
              {avail.map(({ p, busy }) => (
                <button
                  key={p.id}
                  onClick={() => setD({ ...d, personaId: p.id })}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-left cursor-pointer",
                    d.personaId === p.id ? "bg-sel" : "bg-base/60 hover:bg-elev",
                  )}
                >
                  <Avatar persona={p} size={20} />
                  <span className="flex-1 text-bright">{p.name}</span>
                  {busy ? <span className="text-bad">Au travail · {busy}</span> : <span className="text-ok">Disponible</span>}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            {(Object.keys(STATUS) as DeliveryStatus[]).map((k) => (
              <button
                key={k}
                onClick={() => setD({ ...d, status: k })}
                className={clsx("flex-1 rounded-lg border py-1.5 text-[12px] cursor-pointer", d.status === k ? "text-bright" : "border-line text-muted")}
                style={d.status === k ? { borderColor: STATUS[k].color, background: STATUS[k].color + "1f" } : undefined}
              >
                {STATUS[k].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Panel() {
  const deliveries = useApp((s) => s.deliveries);
  const personas = useApp((s) => s.personas);
  const state = useApp();
  const [draft, setDraft] = useState<Delivery | null>(null);
  const sorted = [...deliveries].sort((a, b) => Number(a.status === "livree") - Number(b.status === "livree") || a.date.localeCompare(b.date));
  return (
    <div className="grid gap-2">
      <Button
        icon={Plus}
        onClick={() => setDraft({ id: uid(), title: "", carrier: "Colissimo", date: dayKey(new Date()), slotStart: "09:00", slotEnd: "13:00", status: "attendue" })}
      >
        Nouvelle livraison
      </Button>
      {!sorted.length && <Empty icon={Package} text="Aucun colis attendu." />}
      {sorted.map((d) => {
        const p = personas.find((x) => x.id === d.personaId) as Persona | undefined;
        const busy = p && availability(d, state).find((x) => x.p.id === p.id)?.busy;
        const link = d.tracking ? CARRIERS[d.carrier]?.(d.tracking) : "";
        return (
          <button key={d.id} onClick={() => setDraft(d)} className={clsx("rounded-xl border border-line bg-base/50 p-2.5 text-left hover:border-line2 cursor-pointer", d.status === "livree" && "opacity-55")}>
            <div className="flex items-center gap-2">
              {d.status === "livree" ? <PackageCheck size={15} className="text-ok" /> : <Package size={15} style={{ color: STATUS[d.status].color }} />}
              <span className="flex-1 truncate text-[13px] text-bright">{d.title || "Colis"}</span>
              {link && (
                <span
                  role="link"
                  className="text-muted hover:text-bright"
                  onClick={(e) => {
                    e.stopPropagation();
                    openExternal(link);
                  }}
                >
                  <ExternalLink size={13} />
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11.5px] text-muted">
              <span>
                {fmt(fromKey(d.date), "EEE d MMM")} · {d.slotStart}–{d.slotEnd}
              </span>
              <span className="text-faint">{d.carrier}</span>
              <span className="flex-1" />
              {p && <Avatar persona={p} size={18} />}
            </div>
            {busy && (
              <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-bad/10 px-2 py-1 text-[11.5px] text-bad">
                <AlertTriangle size={12} /> {p!.name} travaille ({busy})
              </div>
            )}
          </button>
        );
      })}
      <DeliveryModal draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

export const deliveriesPlugin: Plugin = {
  id: "deliveries",
  name: "Livraisons",
  tagline: "Colis attendus, créneau, suivi, et qui le récupère — avec alerte si la personne travaille.",
  icon: Package,
  color: "#fbbf24",
  category: "maison",
  defaultOn: true,
  links: ["workplan", "school"],
  items: (from, to, s) => {
    const a = dayKey(from);
    const b = dayKey(to);
    return s.deliveries
      .filter((d) => d.date >= a && d.date < b && d.status !== "livree")
      .map<CalItem>((d) => {
        const day = fromKey(d.date);
        const p = s.personas.find((x) => x.id === d.personaId);
        const busy = p && availability(d, s).find((x) => x.p.id === p.id)?.busy;
        return {
          id: `deliv-${d.id}`,
          title: `📦 ${d.title || "Colis"}`,
          start: atTime(day, d.slotStart),
          end: atTime(day, d.slotEnd),
          allDay: false,
          color: STATUS[d.status].color,
          personaIds: d.personaId ? [d.personaId] : [],
          icon: Package,
          source: "deliveries",
          meta: d.carrier,
          warning: busy ? `${p!.name} travaille (${busy})` : undefined,
        };
      });
  },
  panel: { label: "Colis", component: Panel },
};
