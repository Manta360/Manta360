"use client";

import { useState } from "react";
import { Button, ConfirmationDialog } from "@/components/ui";

type Props = { contractId: string; onCompleted: () => Promise<void> };

export function ContractTerminationButton({ contractId, onCompleted }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function terminate() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/contracts/${contractId}/terminate`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo finalizar el contrato");
      setOpen(false); await onCompleted();
    } catch (terminationError) { setError(terminationError instanceof Error ? terminationError.message : "No se pudo finalizar el contrato"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-2"><Button variant="danger" size="sm" onClick={() => setOpen(true)}>Terminar contrato</Button>{error ? <p role="alert" className="text-xs font-semibold text-danger">{error}</p> : null}<ConfirmationDialog open={open} onClose={() => !busy && setOpen(false)} title="¿Finalizar este contrato?" description="La finalización conserva el historial contractual y actualiza la disponibilidad según las reglas vigentes." confirmLabel="Finalizar contrato" confirmVariant="danger" busy={busy} onConfirm={() => void terminate()} /></div>;
}
