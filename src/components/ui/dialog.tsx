"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  description?: ReactNode;
  className?: string;
};

function firstFocusable(container: HTMLElement) {
  const preferred = container.querySelector<HTMLElement>("[data-autofocus]");
  if (preferred) return preferred;
  const fields = container.querySelectorAll<HTMLElement>("textarea, input, select");
  for (const field of fields) {
    if (!field.hasAttribute("disabled") && field.getAttribute("aria-hidden") !== "true") return field;
  }
  const others = container.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])");
  for (const element of others) {
    if (!element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true") return element;
  }
  return null;
}

export function Dialog({ open, onClose, title, children, description, className }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    queueMicrotask(() => {
      const root = dialogRef.current;
      if (!root) return;
      firstFocusable(root)?.focus();
    });
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-dialog-title"
        aria-describedby={description ? "ui-dialog-description" : undefined}
        className={cn("max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg bg-surface p-6 shadow-lg", className)}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="ui-dialog-title" className="text-xl font-black text-foreground">{title}</h2>
            {description ? <div id="ui-dialog-description" className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
          </div>
          <Button aria-label="Cerrar diálogo" variant="ghost" size="sm" onClick={onClose}>×</Button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

type ConfirmationDialogProps = Omit<DialogProps, "children"> & {
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  confirmVariant?: "primary" | "danger";
  busy?: boolean;
};

export function ConfirmationDialog({
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  confirmVariant = "primary",
  busy = false,
  ...dialog
}: ConfirmationDialogProps) {
  return (
    <Dialog {...dialog}>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={dialog.onClose}>{cancelLabel}</Button>
        <Button data-autofocus variant={confirmVariant} loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
