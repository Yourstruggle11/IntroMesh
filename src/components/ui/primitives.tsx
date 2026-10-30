import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn, hueFrom, initials } from "@/lib/utils";

/* ───────────── Card ───────────── */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-2xl", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 p-5 pb-0", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ───────────── Badge ───────────── */
type BadgeTone = "neutral" | "brand" | "gold" | "success" | "danger" | "violet" | "warning";
const tones: Record<BadgeTone, string> = {
  neutral: "bg-white/[0.06] text-muted border-line",
  brand: "bg-brand/10 text-brand border-brand/25",
  gold: "bg-gold/10 text-gold border-gold/25",
  success: "bg-success/10 text-success border-success/25",
  danger: "bg-danger/10 text-danger border-danger/25",
  violet: "bg-brand-3/10 text-brand-3 border-brand-3/25",
  warning: "bg-warning/10 text-warning border-warning/25",
};
export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5", tones[tone], className)}
      {...props}
    />
  );
}

export function Tag({ children, className, active }: { children: ReactNode; className?: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2 py-0.5 text-xs",
        active ? "border-brand/40 bg-brand/10 text-brand" : "border-line bg-white/[0.03] text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ───────────── Form controls ───────────── */
const field =
  "w-full rounded-xl border border-line bg-white/[0.03] px-3.5 text-fg placeholder:text-subtle outline-none transition focus:border-brand/50 focus:bg-white/[0.05] focus:ring-4 focus:ring-brand/10 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(field, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(field, "min-h-[96px] resize-y py-3 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(field, "h-11 appearance-none bg-surface-2 pr-8", className)} {...props} />;
});

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-fg/90", className)} {...props} />;
}

export function FieldHint({ children, error }: { children: ReactNode; error?: boolean }) {
  return <p className={cn("mt-1.5 text-xs", error ? "text-danger" : "text-subtle")}>{children}</p>;
}

/* ───────────── Avatar ───────────── */
export function Avatar({
  name,
  seed,
  size = 40,
  className,
  ring,
  masked,
}: {
  name: string | null | undefined;
  seed?: string;
  size?: number;
  className?: string;
  ring?: boolean;
  masked?: boolean;
}) {
  const h = hueFrom(seed ?? name ?? "x");
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.36)),
    background: masked
      ? "linear-gradient(135deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.02))"
      : `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 50) % 360} 75% 42%))`,
  };
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-inner select-none",
        ring && "ring-2 ring-bg outline outline-1 outline-white/15",
        masked && "border border-dashed border-white/20 text-muted",
        className,
      )}
      style={style}
      aria-hidden
    >
      {masked ? "?" : initials(name)}
    </span>
  );
}

/* ───────────── Misc ───────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center", className)}>
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-brand">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, description, className, align = "left" }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; className?: string; align?: "left" | "center" }) {
  return (
    <div className={cn(align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>}
      <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {description && <p className={cn("mt-4 text-pretty text-[15px] leading-relaxed text-muted sm:text-base", align === "center" && "mx-auto max-w-2xl")}>{description}</p>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent", className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</kbd>;
}
