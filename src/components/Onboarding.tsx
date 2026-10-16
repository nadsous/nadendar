import { motion } from "framer-motion";
import { Sparkles, UserPlus } from "lucide-react";
import { loadDemo } from "../store/demo";
import { useApp } from "../store/store";
import { PLUGINS } from "../plugins/registry";
import { Button } from "./ui/ui";
import { Logo } from "./Shell";
import { blankPersona } from "./panels/PersonaEditor";

export function Onboarding() {
  const setSettings = useApp((s) => s.setSettings);
  const setUI = useApp((s) => s.setUI);
  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-panel/95 p-6 backdrop-blur">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="flex max-w-[560px] flex-col items-center text-center">
        <motion.div initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}>
          <Logo size={96} />
        </motion.div>
        <h1 className="mt-5 text-[30px] font-semibold tracking-[-0.03em] text-bright">
          Bienvenue sur Nad<span className="text-brand">endar</span>
        </h1>
        <p className="mt-2 text-[14.5px] text-muted">Le calendrier de toute la famille : plannings de travail, école, rendez-vous, courses, livraisons, budget… chacun avec son avatar et sa couleur.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-1.5">
          {PLUGINS.map((p, i) => (
            <motion.span
              key={p.id}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.035 }}
              title={p.name}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]"
              style={{ background: p.color + "1c", color: p.color }}
            >
              <p.icon size={13} /> {p.name}
            </motion.span>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button variant="primary" icon={Sparkles} onClick={loadDemo}>
            Découvrir avec une famille d'exemple
          </Button>
          <Button
            icon={UserPlus}
            onClick={() => {
              setSettings({ onboarded: true });
              setUI({ editingPersona: blankPersona(0) });
            }}
          >
            Partir de zéro
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
