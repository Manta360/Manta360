import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/components/ui/utils";

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-navy",
  accent: "bg-accent text-accent-foreground shadow-sm hover:bg-[#d85c13]",
  secondary: "border border-border bg-surface text-foreground hover:border-sky hover:bg-surface-subtle",
  ghost: "text-primary hover:bg-sky/10",
  danger: "bg-danger text-white shadow-sm hover:bg-[#8a1c14]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-2 text-sm",
  md: "min-h-10 px-4 py-2.5 text-sm",
  lg: "min-h-11 px-5 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
});
