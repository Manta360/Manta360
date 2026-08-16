import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

export function SectionHeader({ eyebrow, title, description, action, className }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
    <div>
      {eyebrow ? <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sky">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl font-black tracking-tight text-navy sm:text-3xl">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl leading-6 text-muted-foreground">{description}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>;
}

export function StatCard({ label, value, detail, tone = "blue" }: { label: string; value: ReactNode; detail?: ReactNode; tone?: "blue" | "sky" | "orange" | "violet" }) {
  const styles = { blue: "border-blue/15 bg-blue/[.04]", sky: "border-sky/25 bg-sky/[.07]", orange: "border-orange/25 bg-orange/[.06]", violet: "border-violet/20 bg-violet/[.06]" };
  return <article className={cn("rounded-2xl border p-5 shadow-sm", styles[tone])}>
    <p className="text-sm font-bold text-muted-foreground">{label}</p>
    <p className="mt-2 text-3xl font-black tracking-tight text-navy">{value}</p>
    {detail ? <p className="mt-2 text-xs font-medium text-muted-foreground">{detail}</p> : null}
  </article>;
}
