import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

export function SectionHeader({ eyebrow, title, description, action, className }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
    <div>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-navy sm:text-3xl">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl leading-6 text-muted-foreground">{description}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>;
}

export function StatCard({ label, value, detail, tone = "blue" }: { label: string; value: ReactNode; detail?: ReactNode; tone?: "blue" | "sky" | "orange" | "violet" }) {
  const accents = { blue: "bg-blue", sky: "bg-sky", orange: "bg-orange", violet: "bg-muted" };
  return <article className="rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:shadow-md">
    <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", accents[tone])} /><p className="text-sm font-semibold text-muted-foreground">{label}</p></div>
    <p className="mt-2 text-3xl font-bold tracking-tight text-navy">{value}</p>
    {detail ? <p className="mt-2 text-xs font-medium text-muted-foreground">{detail}</p> : null}
  </article>;
}
