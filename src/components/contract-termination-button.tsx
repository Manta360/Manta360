"use client";

import { useState } from "react";

type Props = {
  contractId: string;
  onCompleted: () => Promise<void>;
};

export function ContractTerminationButton({ contractId, onCompleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function terminate() {
    if (!window.confirm("¿Deseas finalizar este contrato? Esta acción conservará el historial.")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/contracts/${contractId}/terminate`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo finalizar el contrato");
      await onCompleted();
    } catch (terminationError) {
      setError(terminationError instanceof Error ? terminationError.message : "No se pudo finalizar el contrato");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-2"><button type="button" disabled={busy} onClick={() => void terminate()} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-60">{busy ? "Finalizando..." : "Terminar contrato"}</button>{error ? <p role="alert" className="text-xs font-semibold text-red-700">{error}</p> : null}</div>;
}
