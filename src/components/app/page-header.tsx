import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, action, className }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>}
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted sm:text-[15px]">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, hint, tone = "brand", className }: { label: string; value: ReactNode; icon?: ReactNode; hint?: ReactNode; tone?: "brand" | "gold" | "violet" | "success"; className?: string }) {
  const toneCls = { brand: "text-brand bg-brand/10", gold: "text-gold bg-gold/10", violet: "text-brand-3 bg-brand-3/10", success: "text-success bg-success/10" }[tone];
  return (
    <div className={cn("glass rounded-2xl p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{label}</p>
        {icon && <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneCls)}>{icon}</span>}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}
