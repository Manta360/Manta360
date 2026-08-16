import type { HTMLAttributes } from "react";
import { cn } from "@/components/ui/utils";

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";
const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-subtle text-muted",
  info: "bg-sky/10 text-info",
  success: "bg-emerald-50 text-success",
  warning: "bg-amber-50 text-warning",
  danger: "bg-red-50 text-danger",
};

export function Badge({ className, children, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold", tones[tone], className)} {...props}>{children}</span>;
}
