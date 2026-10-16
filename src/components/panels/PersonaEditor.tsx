import clsx from "clsx";
import { Sparkles, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { uid } from "../../lib/dates";
import { genderOpts, randomSeed } from "../../lib/avatars";
import type { AvatarSpec, Gender, Persona, PersonaRole } from "../../lib/types";
import { useEnabledPlugins } from "../../plugins/registry";
import { useApp } from "../../store/store";
import { defaultAvatar } from "../ui/Avatar";
import { AvatarCustomizer, AvatarPreview } from "./AvatarEditor";
import { Button, ColorDots, Field, Modal, PALETTE, Section } from "../ui/ui";


const ROLES: { id: PersonaRole; label: string }[] = [
  { id: "adulte", label: "Adulte" },
  { id: "ado", label: "Ado" },
  { id: "enfant", label: "Enfant" },
  { id: "bebe", label: "Bébé" },
  { id: "senior", label: "Senior" },
  { id: "autre", label: "Autre" },
];

const GENDERS: { id: Gender; label: string }[] = [
  { id: "femme", label: "Femme" },
  { id: "homme", label: "Homme" },
  { id: "neutre", label: "Neutre" },
];

export const blankPersona = (n = 0): Persona => ({
  id: uid(),
  name: "",
  role: "adulte",
  color: PALETTE[(n * 5 + 2) % PALETTE.length],
  avatar: { ...defaultAvatar("neutre"), style: "notionists", seed: randomSeed(), opts: {} },
});

export function PersonaEditor() {
  const editing = useApp((s) => s.ui.editingPersona);
  const personas = useApp((s) => s.personas);
  const setUI = useApp((s) => s.setUI);
  const { add, update, remove } = useApp.getState();
  const plugins = useEnabledPlugins().filter((p) => p.personaSection);
  const [p, setP] = useState<Persona>(() => blankPersona());

  useEffect(() => {
    if (editing) setP({ ...blankPersona(personas.length), ...editing } as Persona);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const exists = personas.some((x) => x.id === p.id);
  const set = (patch: Partial<Persona>) => {
    setP((cur) => ({ ...cur, ...patch }));
    // Les sections des plugins (planning…) écrivent aussi dans d'autres collections :
    // on enregistre le persona tout de suite s'il existe déjà.
    if (exists) update("personas", p.id, patch);
  };
  const setAv = (a: Partial<AvatarSpec>) => set({ avatar: { ...p.avatar, ...a } });
  const close = () => setUI({ editingPersona: null });
  const save = () => {
    const clean = { ...p, name: p.name.trim() || "Sans nom" };
    if (exists) {
      update("personas", p.id, clean);
      close();
    } else {
      // On reste sur la fiche pour configurer planning, école, cycle…
      add("personas", clean);
      setUI({ editingPersona: clean });
    }
  };

  return (
    <Modal
      open={!!editing}
      onClose={close}
      title={exists ? p.name || "Persona" : "Nouveau persona"}
      icon={UserRound}
      width={720}
      footer={
        <>
          {exists && (
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                remove("personas", p.id);
                close();
              }}
            >
              Supprimer
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={close}>
            {exists ? "Fermer" : "Annuler"}
          </Button>
          <Button variant="primary" onClick={save}>
            {exists ? "Enregistrer" : "Créer"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-[170px_1fr]">
          <AvatarPreview spec={p.avatar} color={p.color} onChange={(avatar) => set({ avatar })} />
          <div className="grid content-start gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom">
                <input className="field" autoFocus value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Léa" />
              </Field>
              <Field label="Anniversaire">
                <input type="date" className="field" value={p.birthday ?? ""} onChange={(e) => set({ birthday: e.target.value || undefined })} />
              </Field>
            </div>
            <Field label="Genre" group>
              <div className="grid grid-cols-3 gap-1.5">
                {GENDERS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() =>
                      p.avatar.style
                        ? setAv({ gender: g.id, opts: genderOpts(p.avatar.style, g.id, p.avatar.opts ?? {}) })
                        : setAv({ ...defaultAvatar(g.id), skin: p.avatar.skin, glasses: p.avatar.glasses })
                    }
                    className={clsx("rounded-lg border py-1.5 text-[12.5px] cursor-pointer", p.avatar.gender === g.id ? "border-brand/60 bg-sel text-bright" : "border-line text-muted")}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Profil" group>
              <div className="grid grid-cols-6 gap-1">
                {ROLES.map((r) => (
                  <button key={r.id} onClick={() => set({ role: r.id })} className={clsx("rounded-lg border py-1.5 text-[12px] cursor-pointer", p.role === r.id ? "border-brand/60 bg-sel text-bright" : "border-line text-muted")}>
                    {r.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Couleur" group>
              <ColorDots value={p.color} onChange={(color) => set({ color })} />
            </Field>
          </div>
        </div>

        <Section title="Avatar" icon={Sparkles}>
          <AvatarCustomizer spec={p.avatar} color={p.color} onChange={(avatar) => set({ avatar })} />
        </Section>

        {exists ? (
          plugins.map((pl) => {
            const S = pl.personaSection!;
            return (
              <Section key={pl.id} title={pl.name} icon={pl.icon} className="border-t border-line pt-4">
                <S persona={p} onChange={set} />
              </Section>
            );
          })
        ) : (
          <p className="rounded-xl bg-base/60 px-3 py-2.5 text-[12.5px] text-muted">
            Après la création : planning de travail, emploi du temps scolaire, cycle, taux horaire…
          </p>
        )}
      </div>
    </Modal>
  );
}
