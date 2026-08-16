import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

type PageHeaderProps = { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string };

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return <header className={cn("flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5", className)}>
    <div>{eyebrow ? <p className="text-sm font-bold uppercase tracking-[0.16em] text-sky">{eyebrow}</p> : null}<h1 className="mt-1 text-3xl font-black tracking-tight text-foreground">{title}</h1>{description ? <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p> : null}</div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </header>;
}
