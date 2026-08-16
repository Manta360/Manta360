"use client";

import { FormEvent, useEffect, useState } from "react";

type Contract = { id: string; status: string; startDate: string; endDate: string; properties: { title: string; address: string } };
type Renewal = { id: string; status: "PENDIENTE" | "APROBADO" | "RECHAZADO"; proposedEndDate: string; createdAt: string; contract: Contract };
type Props = { role: "ARRENDADOR" | "ARRENDATARIO"; contracts: Contract[]; onChanged: () => Promise<void> };

function dateValue(date: string) { return new Date(date).toISOString().slice(0, 10); }
function isEligible(contract: Contract) {
  const remaining = (new Date(contract.endDate).getTime() - Date.now()) / 86_400_000;
  return contract.status === "ACTIVO" && remaining >= 0 && remaining <= 15;
}

export function ContractRenewalPanel({ role, contracts, onChanged }: Props) {
  const [renewals, setRenewals] = useState<Renewal[]>([]); const [selected, setSelected] = useState<Contract | null>(null);
  const [proposedEndDate, setProposedEndDate] = useState(""); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = async () => { const response = await fetch("/api/contract-renewals", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar las renovaciones"); setRenewals(data.renewals ?? []); };
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar las renovaciones")); }, []);
  const requestRenewal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected || !proposedEndDate) return; setBusy(selected.id); setError(null);
    try {
      const response = await fetch(`/api/contracts/${selected.id}/renewal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposedEndDate: new Date(`${proposedEndDate}T00:00:00.000Z`).toISOString() }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No se pudo solicitar la renovacion"); setSelected(null); setProposedEndDate(""); await Promise.all([load(), onChanged()]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo solicitar la renovacion"); } finally { setBusy(null); }
  };
  const decide = async (renewal: Renewal, decision: "APROBAR" | "RECHAZAR") => {
    setBusy(renewal.id); setError(null);
    try {
      const response = await fetch(`/api/contract-renewals/${renewal.id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No se pudo decidir la renovacion"); await Promise.all([load(), onChanged()]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo decidir la renovacion"); } finally { setBusy(null); }
  };
  const eligible = contracts.filter(isEligible);
  return <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm"><h3 className="text-xl font-black text-navy">Renovaciones</h3><p className="mt-1 text-sm text-slate-500">Las solicitudes se habilitan durante los ultimos 15 dias del contrato.</p>{error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}{role === "ARRENDATARIO" && eligible.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{eligible.map((contract) => <button key={contract.id} type="button" disabled={busy !== null} onClick={() => { setSelected(contract); setProposedEndDate(""); }} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Renovar {contract.properties.title}</button>)}</div> : null}{role === "ARRENDATARIO" && selected ? <form onSubmit={(event) => void requestRenewal(event)} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4"><label className="space-y-1 text-sm"><span className="block font-bold text-navy">Nueva fecha final</span><input required type="date" min={dateValue(selected.endDate)} value={proposedEndDate} onChange={(event) => setProposedEndDate(event.target.value)} className="field-input px-3 py-2" /></label><button disabled={busy === selected.id} className="rounded-lg bg-blue px-3 py-2 text-sm font-bold text-white">Enviar solicitud</button><button type="button" onClick={() => setSelected(null)} className="px-2 py-2 text-sm font-bold text-slate-600">Cancelar</button></form> : null}<div className="mt-4 space-y-3">{renewals.length === 0 ? <p className="text-sm text-slate-500">No hay renovaciones registradas.</p> : renewals.map((renewal) => <article key={renewal.id} className="rounded-xl border border-slate-200 p-4"><p className="font-bold text-navy">{renewal.contract.properties.title}</p><p className="mt-1 text-sm text-slate-600">Actual: {new Date(renewal.contract.endDate).toLocaleDateString("es-EC")} · Propuesta: {new Date(renewal.proposedEndDate).toLocaleDateString("es-EC")}</p><p className="mt-1 text-xs font-bold text-blue">{renewal.status}</p>{role === "ARRENDADOR" && renewal.status === "PENDIENTE" ? <div className="mt-3 flex gap-2"><button disabled={busy === renewal.id} onClick={() => void decide(renewal, "APROBAR")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white">Aprobar</button><button disabled={busy === renewal.id} onClick={() => void decide(renewal, "RECHAZAR")} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700">Rechazar</button></div> : null}</article>)}</div></div>;
}
