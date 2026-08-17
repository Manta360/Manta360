import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/components/ui/utils";

type StateProps = { title: string; description?: ReactNode; className?: string; action?: ReactNode };

function StateContainer({ title, description, className, action, icon }: StateProps & { icon: ReactNode }) {
  return <section className={cn("rounded-lg border border-dashed border-border bg-surface p-6 text-center", className)}>
    <div aria-hidden="true" className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface-subtle text-lg text-primary">{icon}</div>
    <h3 className="mt-3 font-black text-foreground">{title}</h3>
    {description ? <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </section>;
}

export function LoadingState({ title = "Cargando", description = "Estamos preparando la información.", className }: Partial<StateProps>) {
  return <div role="status" aria-live="polite"><StateContainer title={title} description={description} className={className} icon={<span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />} /></div>;
}

export function EmptyState({ title, description, className, action }: StateProps) {
  return <StateContainer title={title} description={description} className={className} action={action} icon="—" />;
}

export function ErrorState({ title = "No se pudo cargar la información", description, className, action }: Partial<StateProps>) {
  return <Alert tone="danger" className={className} title={title}>{description}{action ? <div className="mt-3">{action}</div> : null}</Alert>;
}
