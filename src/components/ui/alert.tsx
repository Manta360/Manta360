import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui/utils";

type AlertTone = "info" | "success" | "warning" | "danger";
const tones: Record<AlertTone, string> = {
  info: "border-sky/30 bg-sky/10 text-info",
  success: "border-emerald-200 bg-emerald-50 text-success",
  warning: "border-amber-200 bg-amber-50 text-warning",
  danger: "border-red-200 bg-red-50 text-danger",
};

export function Alert({ className, children, tone = "info", title, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: AlertTone; title?: ReactNode }) {
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 text-sm", tones[tone], className)} {...props}>{title ? <p className="font-bold">{title}</p> : null}<div className={title ? "mt-1" : undefined}>{children}</div></div>;
}
