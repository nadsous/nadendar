import clsx from "clsx";
import { motion } from "framer-motion";
import { Link2, Puzzle } from "lucide-react";
import { isOn, pluginById, PLUGINS } from "../../plugins/registry";
import { CATEGORIES, type PluginCategory } from "../../plugins/types";
import { useApp } from "../../store/store";
import { Modal, Toggle } from "../ui/ui";

export function PluginStore() {
  const open = useApp((s) => s.ui.modal === "plugins");
  const settings = useApp((s) => s.settings);
  const setUI = useApp((s) => s.setUI);
  const toggle = useApp((s) => s.togglePlugin);
  const cats = Object.keys(CATEGORIES) as PluginCategory[];
  const active = PLUGINS.filter((p) => isOn({ settings }, p)).length;

  return (
    <Modal open={open} onClose={() => setUI({ modal: null })} title={`Plugins · ${active}/${PLUGINS.length} actifs`} icon={Puzzle} width={860}>
      <p className="mb-4 text-[13px] text-muted">
        Chaque module s'active ou se retire en un clic. Ceux qui sont liés s'échangent leurs données : une livraison connaît le planning de travail, les menus remplissent les courses, le salaire s'estime
        depuis les heures…
      </p>
      <div className="grid gap-5">
        {cats.map((c) => {
          const list = PLUGINS.filter((p) => p.category === c);
          if (!list.length) return null;
          return (
            <section key={c}>
              <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">{CATEGORIES[c]}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {list.map((p, i) => {
                  const on = isOn({ settings }, p);
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => toggle(p.id, !on)}
                      className={clsx("flex gap-3 rounded-xl border p-3 transition-all cursor-pointer", on ? "border-line2 bg-elev/60" : "border-line bg-base/40 opacity-70 hover:opacity-100")}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: p.color + (on ? "26" : "12"), color: p.color }}>
                        <p.icon size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-[13.5px] font-medium text-bright">{p.name}</span>
                          <Toggle on={on} onChange={(v) => toggle(p.id, v)} label={p.name} />
                        </div>
                        <p className="mt-0.5 text-[12px] leading-snug text-muted">{p.tagline}</p>
                        {p.links?.length ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-faint">
                            <Link2 size={11} />
                            {p.links.map((l) => {
                              const lp = pluginById.get(l);
                              return lp ? (
                                <span key={l} className="rounded px-1" style={{ color: lp.color, background: lp.color + "14" }}>
                                  {lp.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
