import type { HTMLAttributes } from "react";
import { Badge } from "@/components/ui/badge";

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const statusPresentation: Record<string, { label: string; tone: StatusTone }> = {
  DISPONIBLE: { label: "Disponible", tone: "success" },
  OCUPADO: { label: "Ocupado", tone: "info" },
  MANTENIMIENTO: { label: "Mantenimiento", tone: "warning" },
  INHABILITADO: { label: "Inhabilitado", tone: "danger" },
  PENDIENTE_FIRMA: { label: "Pendiente de firma", tone: "warning" },
  PENDIENTE_MUNICIPIO: { label: "Pendiente municipal", tone: "warning" },
  ACTIVO: { label: "Activo", tone: "success" },
  RECHAZADO_MUNICIPIO: { label: "Rechazado por Municipio", tone: "danger" },
  FINALIZADO: { label: "Finalizado", tone: "neutral" },
  EN_RENOVACION: { label: "En renovación", tone: "info" },
  PENDIENTE: { label: "Pendiente", tone: "warning" },
  APROBADO: { label: "Aprobado", tone: "success" },
  RECHAZADO: { label: "Rechazado", tone: "danger" },
  EN_PROCESO: { label: "En proceso", tone: "info" },
  RESUELTO: { label: "Resuelto", tone: "success" },
  EN_REVISION: { label: "En revisión", tone: "info" },
  VERIFICADO: { label: "Verificado", tone: "success" },
};

export function statusLabel(status: string): string {
  return statusPresentation[status]?.label ?? status.replaceAll("_", " ");
}

export function StatusBadge({ status, className, ...props }: HTMLAttributes<HTMLSpanElement> & { status: string }) {
  const presentation = statusPresentation[status] ?? { label: statusLabel(status), tone: "neutral" as const };
  return <Badge tone={presentation.tone} className={className} {...props}>{presentation.label}</Badge>;
}
