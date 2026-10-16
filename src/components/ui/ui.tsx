import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useApp } from "../../store/store";
import { Avatar } from "./Avatar";

export const PALETTE = [
  "#fe7146", "#f43f5e", "#ec4899", "#d946ef", "#a855f7", "#8b5cf6", "#6366f1", "#3b82f6",
  "#0ea5e9", "#06b6d4", "#14b8a6", "#10b981", "#22c55e", "#84cc16", "#eab308", "#f59e0b",
];

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "soft" | "danger";
  size?: "sm" | "md";
  icon?: LucideIcon;
};

export function Button({ variant = "soft", size = "md", icon: Icon, className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-[9px] font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap cursor-pointer",
        size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-[34px] px-3.5 text-[13.5px]",
        variant === "primary" && "bg-brand text-on-brand hover:brightness-110 shadow-[0_6px_20px_-8px_rgba(254,113,70,0.6)]",
        variant === "soft" && "bg-elev text-bright hover:bg-elev2 border border-line",
        variant === "ghost" && "text-muted hover:text-bright hover:bg-elev",
        variant === "danger" && "bg-bad/10 text-bad hover:bg-bad/20 border border-bad/20",
        className,
      )}
    >
      {Icon && <Icon size={size === "sm" ? 14 : 15} strokeWidth={2} />}
      {children}
    </button>
  );
}

export function IconBtn({
  icon: Icon,
  label,
  active,
  className,
  size = 16,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean; size?: number }) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer shrink-0",
        active ? "bg-elev text-brand" : "text-muted hover:text-bright hover:bg-elev",
        className,
      )}
    >
      <Icon size={size} strokeWidth={1.9} />
    </button>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("flex flex-col gap-1.5 min-w-0", className)}>
      <span className="text-[12px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
    </label>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className={clsx(
        "relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 cursor-pointer",
        on ? "bg-brand" : "bg-elev2",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 34 }}
        className={clsx("absolute top-[3px] h-4 w-4 rounded-full shadow", on ? "right-[3px] bg-on-brand" : "left-[3px] bg-fg")}
      />
    </button>
  );
}

export function ColorDots({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={clsx(
            "h-6 w-6 rounded-md transition-transform hover:scale-110 cursor-pointer",
            value === c && "ring-2 ring-offset-2 ring-offset-panel ring-white/80",
          )}
          style={{ background: c }}
          aria-label={c}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="field !h-6 !w-8 !p-0.5" />
    </div>
  );
}

export function Section({ title, icon: Icon, action, children, className }: { title: string; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2 px-0.5">
        {Icon && <Icon size={14} className="text-brand" />}
        <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted flex-1">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ icon: Icon, text, children }: { icon: LucideIcon; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-muted">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-elev">
        <Icon size={20} className="text-faint" />
      </div>
      <p className="text-[13px] max-w-[240px]">{text}</p>
      {children}
    </div>
  );
}

export function PersonaSelect({ value, onChange, allowEmpty = true, placeholder = "Personne" }: { value?: string; onChange: (id?: string) => void; allowEmpty?: boolean; placeholder?: string }) {
  const personas = useApp((s) => s.personas);
  return (
    <select className="field" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      {allowEmpty && <option value="">{placeholder}</option>}
      {personas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

/** Sélection multiple de personas par avatars. */
export function PersonaPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const personas = useApp((s) => s.personas);
  if (!personas.length) return <p className="text-[12.5px] text-faint">Aucun persona pour l'instant.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {personas.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}
            className={clsx(
              "flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-[12.5px] transition-all cursor-pointer",
              on ? "text-bright" : "border-line text-muted opacity-70 hover:opacity-100",
            )}
            style={on ? { borderColor: p.color, background: p.color + "22" } : undefined}
          >
            <Avatar persona={p} size={22} />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  icon: Icon,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[3px] sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-label={title}
            className="panel flex max-h-[92dvh] w-full flex-col overflow-hidden !rounded-b-none sm:!rounded-[16px] shadow-2xl shadow-black/60"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <header className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
              {Icon && (
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-sel text-brand">
                  <Icon size={15} />
                </span>
              )}
              <h2 className="flex-1 text-[15px] font-semibold text-bright">{title}</h2>
              <IconBtn icon={X} label="Fermer" onClick={onClose} />
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <footer className="flex items-center gap-2 border-t border-line px-5 py-3 safe-bottom">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Tag({ color, children, className }: { color: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx("inline-flex items-center gap-1 rounded-md px-1.5 py-[1px] text-[11px] font-medium", className)}
      style={{ background: color + "22", color }}
    >
      {children}
    </span>
  );
}
