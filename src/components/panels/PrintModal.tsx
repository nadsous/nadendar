import clsx from "clsx";
import { addMonths, addWeeks, startOfMonth, startOfWeek } from "date-fns";
import { CalendarDays, Columns3, Factory, FileDown, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cap, fmt, WEEK } from "../../lib/dates";
import { saveExport } from "../../lib/platform";
import { isOn, pluginById } from "../../plugins/registry";
import { useApp } from "../../store/store";
import { PAGE_H, PAGE_W, PRINT_CATEGORIES, PrintSheet, type PrintKind, type PrintOptions } from "../print/PrintSheet";
import { Button, Field, Modal, PersonaPicker, Toggle } from "../ui/ui";

const isAndroid = () => /android/i.test(navigator.userAgent);


export function PrintModal() {
  const open = useApp((s) => s.ui.modal === "print");
  const setUI = useApp((s) => s.setUI);
  const state = useApp();
  const workplanOn = isOn(state, pluginById.get("workplan")!);
  const [opts, setOpts] = useState<PrintOptions>(() => ({
    kind: "month",
    from: Date.now(),
    count: 1,
    personaIds: [],
    dark: false,
    showChips: true,
    // Par discrétion, le cycle n'est pas imprimé tant qu'on ne l'a pas coché.
    hidden: useApp.getState().settings.printHidden ?? ["cycle"],
  }));
  const [busy, setBusy] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  // L'aperçu se cale sur la largeur disponible (téléphone compris).
  const SCALE = Math.min(0.42, (window.innerWidth - 72) / PAGE_W);

  // À l'ouverture : période affichée et personas visibles.
  useEffect(() => {
    if (!open) return;
    const view = state.settings.view;
    setOpts((o) => ({
      ...o,
      kind: view === "week" || view === "day" ? "week" : view === "planning" && workplanOn ? "planning" : "month",
      from: state.ui.cursor,
      personaIds: state.personas.filter((p) => !p.hidden).map((p) => p.id),
    }));
    setBusy(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Impression : on monte les pages hors de l'application, le CSS @media print fait le reste.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done, { once: true });
    const t = setTimeout(() => window.print(), 150);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  const set = (p: Partial<PrintOptions>) => setOpts((o) => ({ ...o, ...p }));
  const toggleHidden = (id: string) => {
    const hidden = opts.hidden.includes(id) ? opts.hidden.filter((x) => x !== id) : [...opts.hidden, id];
    set({ hidden });
    useApp.getState().setSettings({ printHidden: hidden });
  };
  const close = () => setUI({ modal: null });

  const rangeLabel = useMemo(() => {
    if (opts.kind === "week") {
      const a = startOfWeek(new Date(opts.from), WEEK);
      const b = addWeeks(a, opts.count - 1);
      return opts.count === 1 ? `Semaine du ${fmt(a, "d MMMM yyyy")}` : `Du ${fmt(a, "d MMM")} au ${fmt(addWeeks(b, 1), "d MMM yyyy")}`;
    }
    const a = startOfMonth(new Date(opts.from));
    const b = addMonths(a, opts.count - 1);
    return opts.count === 1 ? cap(fmt(a, "MMMM yyyy")) : `${cap(fmt(a, "MMMM"))} → ${fmt(b, "MMMM yyyy")}`;
  }, [opts.kind, opts.from, opts.count]);

  const exportPdf = async () => {
    const pages = preview.current?.querySelectorAll<HTMLElement>(".print-page");
    if (!pages?.length) return;
    setBusy("Préparation…");
    try {
      const [{ jsPDF }, { toJpeg }] = await Promise.all([import("jspdf"), import("html-to-image")]);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      for (let i = 0; i < pages.length; i++) {
        setBusy(`Page ${i + 1} / ${pages.length}`);
        // Capture à taille réelle (l'aperçu est réduit par son parent, pas la page elle-même).
        const url = await toJpeg(pages[i], {
          quality: 0.93,
          pixelRatio: 2.4,
          width: PAGE_W,
          height: PAGE_H,
          backgroundColor: opts.dark ? "#111113" : "#ffffff",
          cacheBust: false,
        });
        if (i > 0) pdf.addPage("a4", "landscape");
        pdf.addImage(url, "JPEG", 0, 0, 297, 210, undefined, "FAST");
      }
      pdf.setProperties({ title: `Nadendar — ${rangeLabel}`, creator: "Nadendar" });
      const name = `Nadendar ${rangeLabel}.pdf`.replace(/\s+/g, " ");
      setBusy("Enregistrement…");
      const path = await saveExport(name, new Uint8Array(pdf.output("arraybuffer")));
      setBusy(path ? `Enregistré : ${path}` : "PDF téléchargé ✓");
    } catch (e) {
      setBusy(`Échec : ${(e as Error).message}`);
    }
  };

  const kinds: { id: PrintKind; label: string; icon: typeof CalendarDays }[] = [
    { id: "month", label: "Mois", icon: CalendarDays },
    { id: "week", label: "Semaine", icon: Columns3 },
    ...(workplanOn ? [{ id: "planning" as const, label: "Planning travail", icon: Factory }] : []),
  ];

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title="Imprimer / PDF"
        icon={Printer}
        width={1040}
        footer={
          <>
            <span className={clsx("flex min-w-0 items-center gap-1.5 truncate text-[12.5px]", busy?.startsWith("Échec") ? "text-bad" : "text-muted")}>
              {busy && !busy.includes("✓") && !busy.startsWith("Enregistré") && !busy.startsWith("Échec") && <Loader2 size={14} className="animate-spin" />}
              {busy ?? `${opts.count} page${opts.count > 1 ? "s" : ""} A4 paysage`}
            </span>
            <span className="flex-1" />
            {!isAndroid() && (
              <Button icon={Printer} onClick={() => setPrinting(true)}>
                Imprimer
              </Button>
            )}
            <Button variant="primary" icon={FileDown} onClick={exportPdf} disabled={!!busy && !busy.includes("✓") && !busy.startsWith("Enregistré") && !busy.startsWith("Échec")}>
              Enregistrer en PDF
            </Button>
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-[260px_1fr]">
          <div className="grid content-start gap-4">
            <Field label="Mise en page" group>
              <div className="grid gap-1.5">
                {kinds.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => set({ kind: k.id })}
                    className={clsx("flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] cursor-pointer", opts.kind === k.id ? "border-brand/60 bg-sel text-bright" : "border-line text-muted hover:text-fg")}
                  >
                    <k.icon size={15} /> {k.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={opts.kind === "week" ? "Nombre de semaines" : "Nombre de mois"} hint={rangeLabel}>
              <div className="flex items-center gap-2">
                <input type="range" min={1} max={12} value={opts.count} onChange={(e) => set({ count: +e.target.value })} className="flex-1 accent-[#fe7146]" />
                <span className="w-6 text-right tabular text-bright">{opts.count}</span>
              </div>
            </Field>
            <Field label="Personas imprimées" group>
              <PersonaPicker value={opts.personaIds} onChange={(personaIds) => set({ personaIds })} />
            </Field>
            {/* Pas de <label> englobant : un clic sur le titre ne doit cocher aucune case. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted">Éléments à imprimer</span>
              <div className="grid gap-1">
                {PRINT_CATEGORIES.map((c) => {
                  const on = !opts.hidden.includes(c.id);
                  return (
                    <label key={c.id} className={clsx("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] cursor-pointer", on ? "text-bright" : "text-faint line-through")}>
                      <input type="checkbox" checked={on} onChange={() => toggleHidden(c.id)} />
                      {c.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-3 text-[13px]">
              <Toggle on={opts.showChips} onChange={(v) => set({ showChips: v })} /> Pastilles des personas
            </label>
            <label className="flex items-center gap-3 text-[13px]">
              <Toggle on={opts.dark} onChange={(v) => set({ dark: v })} /> Fond sombre (style Nadendar)
            </label>
            <p className="text-[11.5px] text-faint">
              Chaque page est en A4 paysage à taille fixe : les cases ne sont jamais coupées, ce qui dépasse est résumé en « +N autres ».
            </p>
          </div>
          {/* Aperçu réduit ; ces mêmes pages servent au PDF. */}
          <div className="max-h-[50vh] md:max-h-[62vh] overflow-auto rounded-xl border border-line bg-base p-2 md:p-4">
            <div style={{ width: PAGE_W * SCALE, height: (PAGE_H * opts.count + 24 * (opts.count - 1)) * SCALE }}>
              <div ref={preview} style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", width: PAGE_W }}>
                {open && <PrintSheet s={state} opts={opts} />}
              </div>
            </div>
          </div>
        </div>
      </Modal>
      {printing &&
        createPortal(
          <div id="print-root">
            <PrintSheet s={state} opts={opts} />
          </div>,
          document.body,
        )}
    </>
  );
}
