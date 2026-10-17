import clsx from "clsx";
import { motion } from "framer-motion";
import { Ban, Dices, Glasses, Palette, RotateCcw } from "lucide-react";
import { memo, useDeferredValue, useMemo, useState } from "react";
import { DICE_STYLES, diceUri, genderOpts, partsOf, randomSeed } from "../../lib/avatars";
import type { AvatarSpec, HairStyle } from "../../lib/types";
import { AvatarSvg, SKINS } from "../ui/Avatar";
import { Button, Toggle } from "../ui/ui";

const HAIRS: { id: HairStyle; label: string }[] = [
  { id: "court", label: "Court" },
  { id: "mi-long", label: "Mi-long" },
  { id: "long", label: "Long" },
  { id: "queue", label: "Queue" },
  { id: "chignon", label: "Chignon" },
  { id: "boucle", label: "Bouclé" },
  { id: "chauve", label: "Rasé" },
];

const isDice = (s: AvatarSpec) => !!s.style && s.style !== "classic";

/** Grand aperçu + tirage au hasard. */
export function AvatarPreview({ spec, color, onChange }: { spec: AvatarSpec; color: string; onChange: (s: AvatarSpec) => void }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        key={JSON.stringify(spec) + color}
        initial={{ scale: 0.9, rotate: -4 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
      >
        <AvatarSvg spec={spec} color={color} size={140} />
      </motion.div>
      {isDice(spec) && (
        <div className="flex gap-1.5">
          <Button size="sm" icon={Dices} onClick={() => onChange({ ...spec, seed: randomSeed(), opts: genderOpts(spec.style!, spec.gender, {}) })} title="Tirer un nouvel avatar au hasard">
            Hasard
          </Button>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => onChange({ ...spec, opts: genderOpts(spec.style!, spec.gender, {}) })} title="Annuler les choix manuels" />
        </div>
      )}
    </div>
  );
}

/** Style + toutes les parties personnalisables. */
export const AvatarCustomizer = memo(function AvatarCustomizer({ spec, color, onChange }: { spec: AvatarSpec; color: string; onChange: (s: AvatarSpec) => void }) {
  const seed = spec.seed ?? "nadendar";
  const opts = spec.opts ?? {};
  // Les vignettes (jusqu'à ~80 avatars) se recalculent après le clic, sans bloquer la fiche.
  const thumbOpts = useDeferredValue(opts);
  const parts = useMemo(() => (isDice(spec) ? partsOf(spec.style!) : { variants: [], colors: [] }), [spec.style]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<string>("");
  const current = parts.variants.find((v) => v.prop === tab) ?? (tab === "colors" ? null : parts.variants[0]);
  const setOpt = (patch: Record<string, string | number | undefined>) => {
    const next = { ...opts };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete next[k];
      else next[k] = v;
    }
    onChange({ ...spec, opts: next });
  };

  return (
    <div className="grid gap-3">
      {/* Choix du style */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <StyleChip label="Classique" active={!isDice(spec)} onClick={() => onChange({ ...spec, style: undefined })}>
          <AvatarSvg spec={{ ...spec, style: undefined }} color={color} size={46} />
        </StyleChip>
        {DICE_STYLES.map((s) => (
          <StyleChip
            key={s.id}
            label={s.label}
            active={spec.style === s.id}
            onClick={() => {
              if (spec.style === s.id) return;
              onChange({ ...spec, style: s.id, seed: spec.seed ?? randomSeed(), opts: genderOpts(s.id, spec.gender, {}) });
              setTab("");
            }}
          >
            <AvatarSvg spec={{ ...spec, style: s.id, seed, opts: genderOpts(s.id, spec.gender, {}) }} color={color} size={46} />
          </StyleChip>
        ))}
      </div>

      {!isDice(spec) ? (
        <ClassicControls spec={spec} color={color} onChange={onChange} />
      ) : (
        <>
          {/* Onglets des parties */}
          <div className="flex flex-wrap gap-1">
            {parts.variants.map((v) => (
              <button
                key={v.prop}
                onClick={() => setTab(v.prop)}
                className={clsx("rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer", current?.prop === v.prop ? "bg-brand text-on-brand" : "bg-elev text-muted hover:text-bright")}
              >
                {v.label}
                {opts[v.prop] !== undefined && <span className="ml-1 opacity-70">•</span>}
              </button>
            ))}
            {parts.colors.length > 0 && (
              <button
                onClick={() => setTab("colors")}
                className={clsx("flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer", tab === "colors" ? "bg-brand text-on-brand" : "bg-elev text-muted hover:text-bright")}
              >
                <Palette size={12} /> Couleurs
              </button>
            )}
          </div>

          {tab === "colors" ? (
            <div className="grid gap-2.5 rounded-xl border border-line bg-base/50 p-3">
              {parts.colors.map((c) => (
                <div key={c.prop} className="grid grid-cols-[110px_1fr] items-center gap-2">
                  <span className="text-[12px] text-muted">{c.label}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.palette.map((hex) => (
                      <button
                        key={hex}
                        onClick={() => setOpt({ [c.prop]: hex })}
                        className={clsx("h-6 w-6 rounded-md border border-black/20 cursor-pointer transition-transform hover:scale-110", opts[c.prop] === hex && "ring-2 ring-brand ring-offset-2 ring-offset-panel")}
                        style={{ background: `#${hex}` }}
                        aria-label={`${c.label} #${hex}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={`#${typeof opts[c.prop] === "string" ? opts[c.prop] : c.palette[0]}`}
                      onChange={(e) => setOpt({ [c.prop]: e.target.value.slice(1) })}
                      className="field !h-6 !w-8 !p-0.5"
                      title="Couleur libre"
                    />
                    {opts[c.prop] !== undefined && (
                      <button className="text-[11px] text-faint hover:text-fg cursor-pointer" onClick={() => setOpt({ [c.prop]: undefined })}>
                        auto
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            current && (
              <div className="grid max-h-[260px] grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5 overflow-y-auto rounded-xl border border-line bg-base/50 p-2">
                {current.probability && (
                  <Thumb active={opts[current.probability] === 0} onClick={() => setOpt({ [current.probability!]: 0, [current.prop]: undefined })} title="Aucun">
                    <span className="grid h-full w-full place-items-center text-faint">
                      <Ban size={20} />
                    </span>
                  </Thumb>
                )}
                {current.options.map((o) => {
                  const pv = { ...thumbOpts, [current.prop]: o, ...(current.probability ? { [current.probability]: 100 } : {}) };
                  return (
                    <Thumb
                      key={o}
                      active={opts[current.prop] === o && (!current.probability || opts[current.probability] !== 0)}
                      onClick={() => setOpt({ [current.prop]: o, ...(current.probability ? { [current.probability]: 100 } : {}) })}
                      title={o}
                    >
                      <img src={diceUri(spec.style!, seed, pv)} alt="" className="mx-auto h-14 w-14 object-contain" loading="lazy" draggable={false} />
                    </Thumb>
                  );
                })}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}, (a, b) => a.spec === b.spec && a.color === b.color);

function StyleChip({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={clsx("flex shrink-0 flex-col items-center gap-1 rounded-xl p-1.5 cursor-pointer transition-colors", active ? "bg-sel ring-2 ring-brand" : "hover:bg-elev")}>
      {children}
      <span className={clsx("text-[10.5px]", active ? "text-bright" : "text-muted")}>{label}</span>
    </button>
  );
}

function Thumb({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx("h-14 w-full overflow-hidden rounded-lg bg-panel transition-transform cursor-pointer hover:scale-105", active ? "ring-2 ring-brand" : "ring-1 ring-line")}
    >
      {children}
    </button>
  );
}

/** L'avatar maison de Nadendar (coiffure, peau, lunettes, barbe). */
function ClassicControls({ spec, color, onChange }: { spec: AvatarSpec; color: string; onChange: (s: AvatarSpec) => void }) {
  const set = (p: Partial<AvatarSpec>) => onChange({ ...spec, ...p });
  return (
    <div className="grid gap-3 rounded-xl border border-line bg-base/50 p-3">
      <div className="flex flex-wrap gap-1.5">
        {HAIRS.map((h) => (
          <button key={h.id} onClick={() => set({ hair: h.id })} title={h.label} className={clsx("rounded-xl p-0.5 cursor-pointer transition-transform hover:scale-105", spec.hair === h.id && "ring-2 ring-brand")}>
            <AvatarSvg spec={{ ...spec, hair: h.id }} color={color} size={40} />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1.5">
          {SKINS.map((s, i) => (
            <button key={s} onClick={() => set({ skin: i })} className={clsx("h-5 w-5 rounded-full border border-black/30 cursor-pointer", spec.skin === i && "ring-2 ring-brand ring-offset-2 ring-offset-panel")} style={{ background: s }} aria-label={`Peau ${i + 1}`} />
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          <Toggle on={spec.glasses} onChange={(v) => set({ glasses: v })} />
          <Glasses size={14} />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          <Toggle on={spec.beard} onChange={(v) => set({ beard: v })} />
          Barbe
        </label>
      </div>
    </div>
  );
}
