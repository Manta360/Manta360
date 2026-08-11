"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function IdentityValidationBadge() {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/identity-documents").then(async (response) => response.ok ? response.json() : { documents: [] }).then((data) => { const documents = data.documents ?? []; const sides = new Set(documents.filter((item: { documentType: string; isCurrent: boolean; verificationStatus: string }) => item.documentType === "CEDULA" && item.isCurrent && item.verificationStatus === "VERIFICADO").map((item: { side?: string }) => item.side)); setReady(documents.some((item: { documentType: string; isCurrent: boolean; verificationStatus: string }) => item.documentType === "PASAPORTE" && item.isCurrent && item.verificationStatus === "VERIFICADO") || (sides.has("FRENTE") && sides.has("REVERSO"))); }).catch(() => setReady(false)); }, []);
  if (ready === null) return <div className="animate-pulse rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-500">Comprobando identidad...</div>;
  return ready ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-bold text-emerald-800">✓ Documentos validados con éxito</div> : <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Tu identidad sigue pendiente de validación municipal. <Link href="/panel/documentos" className="font-bold underline">Ver documentos</Link></div>;
}
