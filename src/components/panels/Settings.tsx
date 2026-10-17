import clsx from "clsx";
import { Download, House, MapPin, Monitor, Moon, RotateCcw, Settings2, Sparkles, Sun, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { saveBackupFile } from "../../lib/platform";
import type { GeoPlace, SchoolZone, ThemeMode } from "../../lib/types";
import { searchPlaces } from "../../lib/weather";
import { exportData, useApp } from "../../store/store";
import { CELL_SIZES } from "../Shell";
import { SyncPanel } from "./SyncPanel";
import { UpdateCheckButton } from "../Updates";
import { APP_VERSION } from "../../lib/updates";
import { loadDemo } from "../../store/demo";
import { Button, Field, Modal, Section, Toggle } from "../ui/ui";

function PlaceSearch() {
  const place = useApp((s) => s.settings.place);
  const setSettings = useApp((s) => s.setSettings);
  const setCache = useApp((s) => s.setCache);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<GeoPlace[]>([]);
  useEffect(() => {
    const t = setTimeout(() => searchPlaces(q).then(setRes).catch(() => setRes([])), 300);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
        <input className="field !pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={place ? `${place.name} — changer…` : "Paris (par défaut) — chercher une ville…"} />
      </div>
      {res.length > 0 && (
        <div className="grid overflow-hidden rounded-lg border border-line">
          {res.map((r) => (
            <button
              key={`${r.lat},${r.lon}`}
              onClick={() => {
                setSettings({ place: r });
                setCache({ weather: null });
                setQ("");
                setRes([]);
              }}
              className="flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-elev cursor-pointer"
            >
              <MapPin size={13} className="text-brand" /> {r.name}
              <span className="ml-auto text-[11.5px] text-faint">{r.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingsModal() {
  const open = useApp((s) => s.ui.modal === "settings");
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const setUI = useApp((s) => s.setUI);
  const replaceData = useApp((s) => s.replaceData);
  const setCache = useApp((s) => s.setCache);
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  return (
    <Modal open={open} onClose={() => setUI({ modal: null })} title="Réglages" icon={Settings2} width={560}>
      <div className="grid gap-6">
        <Section title="Foyer : partager entre appareils" icon={House}>
          <SyncPanel />
        </Section>
        <Section title="Lieu (météo, soleil, lune)" icon={MapPin}>
          <PlaceSearch />
        </Section>
        <Section title="Taille des cases du mois">
          <div className="grid grid-cols-2 gap-1.5">
            {CELL_SIZES.map((c) => (
              <button
                key={c.id}
                onClick={() => setSettings({ cellSize: c.id })}
                className={clsx(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12.5px] transition-colors cursor-pointer",
                  (settings.cellSize ?? "fit") === c.id ? "border-brand/60 bg-sel text-bright" : "border-line text-muted hover:text-fg",
                )}
              >
                <c.icon size={16} className="shrink-0" /> {c.label}
              </button>
            ))}
          </div>
          <p className="text-[11.5px] text-faint">Astuce : Ctrl + molette sur le calendrier change la taille.</p>
        </Section>
        <Section title="Vacances scolaires">
          <Field label="Zone">
            <select className="field" value={settings.schoolZone} onChange={(e) => (setSettings({ schoolZone: e.target.value as SchoolZone }), setCache({ schoolHolidays: null }))}>
              <option>Zone A</option>
              <option>Zone B</option>
              <option>Zone C</option>
              <option>Corse</option>
            </select>
          </Field>
        </Section>
        <Section title="Affichage">
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["dark", "Sombre", Moon],
                ["light", "Clair", Sun],
                ["system", "Système", Monitor],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setSettings({ theme: id as ThemeMode })}
                className={clsx(
                  "flex flex-col items-center gap-1.5 rounded-xl border py-3 text-[12.5px] transition-colors cursor-pointer",
                  (settings.theme ?? "dark") === id ? "border-brand/60 bg-sel text-bright" : "border-line text-muted hover:text-fg",
                )}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </div>
          {(
            [
              ["animations", "Animations"],
              ["notifications", "Notifications de rappel"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-3 text-[13px]">
              <Toggle on={settings[k]} onChange={(v) => setSettings({ [k]: v })} /> {label}
            </label>
          ))}
        </Section>
        <Section title="Données">
          <p className="text-[12.5px] text-muted">Tout reste sur cet appareil. Exporte une sauvegarde pour la transférer (PC ↔ Android).</p>
          <div className="flex flex-wrap gap-2">
            <Button
              icon={Download}
              onClick={async () => {
                const path = await saveBackupFile(exportData());
                setMsg(path ? `Sauvegardé : ${path}` : "Fichier téléchargé.");
              }}
            >
              Exporter
            </Button>
            <Button icon={Upload} onClick={() => file.current?.click()}>
              Importer
            </Button>
            <input
              ref={file}
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const j = JSON.parse(await f.text());
                  const { settings: s, version: _v, ...data } = j;
                  replaceData(data);
                  if (s) setSettings(s);
                  setMsg("Données importées.");
                } catch {
                  setMsg("Fichier illisible.");
                }
              }}
            />
            <Button icon={Sparkles} onClick={() => (loadDemo(), setMsg("Famille d'exemple chargée."))}>
              Exemple
            </Button>
            <Button
              variant="danger"
              icon={RotateCcw}
              onClick={() => {
                if (confirm("Effacer toutes les données de Nadendar ?")) {
                  replaceData({});
                  setMsg("Tout est effacé.");
                }
              }}
            >
              Tout effacer
            </Button>
          </div>
          {msg && <p className="text-[12px] text-ok">{msg}</p>}
        </Section>
        <Section title={`Version ${APP_VERSION}`}>
          <p className="text-[12.5px] text-muted">Nadendar vérifie seul les nouvelles versions au lancement et prévient quand il y en a une.</p>
          <UpdateCheckButton />
        </Section>
      </div>
    </Modal>
  );
}
