import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/components/ui/utils";

const fieldClassName = "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-foreground outline-none placeholder:text-slate-400 transition focus:border-sky focus:ring-4 focus:ring-sky/15 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-muted-foreground";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldClassName, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return <select ref={ref} className={cn(fieldClassName, className)} {...props}>{children}</select>;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldClassName, "min-h-24 resize-y", className)} {...props} />;
});
