"use client";

import { useEffect, useState } from "react";

type Property = {
  id: string;
  title: string;
  address: string;
  monthlyRent: number;
  approved: boolean;
  status: string;
  users_properties_landlordIdTousers: { fullName: string; email: string };
};
type Stats = { users: number; pendingProperties: number; occupiedProperties: number; activeContracts: number };
type Contract = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  monthlyRent: number | null;
  municipalReviewNotes?: string | null;
  properties: { title: string; address: string };
  users_contracts_tenantIdTousers: { fullName: string; email: string };
  users_contracts_landlordIdTousers: { fullName: string; email: string };
};

export function SuperadminDashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [propertyResponse, contractResponse] = await Promise.all([fetch("/api/admin/properties"), fetch("/api/contracts")]);
    const [propertyData, contractData] = await Promise.all([propertyResponse.json(), contractResponse.json()]);
    if (!propertyResponse.ok) {
      setError(propertyData.error ?? "No se pudo cargar el panel");
      return;
    }
    if (!contractResponse.ok) {
      setError(contractData.error ?? "No se pudieron cargar los contratos");
      return;
    }
    setProperties(propertyData.properties ?? []);
    setStats(propertyData.stats ?? null);
    setContracts(contractData.contracts ?? []);
  };

  useEffect(() => { void load(); }, []);

  const approveProperty = async (id: string, approved: boolean) => {
    const response = await fetch(`/api/admin/properties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo actualizar la propiedad");
      return;
    }
    await load();
  };

  const reviewContract = async (id: string, decision: "APROBAR" | "RECHAZAR") => {
    const notes = decision === "RECHAZAR" ? window.prompt("Motivo para las partes (opcional):") ?? "" : "";
    setBusy(id);
    const response = await fetch(`/api/admin/contracts/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, notes }),
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "No se pudo revisar el contrato");
      return;
    }
    await load();
  };

  const pendingContracts = contracts.filter((contract) => contract.status === "PENDIENTE_MUNICIPIO");

  return <section className="space-y-7">
    <div>
      <p className="text-sm font-bold uppercase tracking-[.18em] text-sky">Administración municipal</p>
      <h2 className="mt-2 text-3xl font-black text-navy">Centro de control Manta360</h2>
      <p className="mt-2 text-slate-600">Valida documentos, publicaciones y contratos antes de que un inmueble sea ocupado.</p>
    </div>
    {stats ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Usuarios", stats.users], ["Por aprobar", stats.pendingProperties], ["Ocupadas", stats.occupiedProperties], ["Contratos activos", stats.activeContracts]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-navy p-5 text-white"><p className="text-sm text-blue-100">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}</div> : null}
    {error ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : null}
    <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-black text-navy">Contratos por revisar</h3><p className="mt-1 text-sm text-slate-600">Ambas partes ya firmaron. Tu aprobación formaliza el contrato y ocupa el inmueble.</p></div><span className="rounded-full bg-violet px-3 py-1 text-sm font-bold text-white">{pendingContracts.length} pendientes</span></div>
      <div className="mt-4 space-y-3">{pendingContracts.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No hay contratos esperando aprobación municipal.</p> : pendingContracts.map((contract) => <article key={contract.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-violet-100 bg-white p-4"><div><p className="font-bold text-navy">{contract.properties.title}</p><p className="text-sm text-slate-500">{contract.users_contracts_landlordIdTousers.fullName} ↔ {contract.users_contracts_tenantIdTousers.fullName}</p><p className="mt-1 text-xs text-slate-500">{new Date(contract.startDate).toLocaleDateString("es-EC")} a {new Date(contract.endDate).toLocaleDateString("es-EC")}</p></div><div className="flex gap-2"><button disabled={busy === contract.id} onClick={() => void reviewContract(contract.id, "APROBAR")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Aprobar contrato</button><button disabled={busy === contract.id} onClick={() => void reviewContract(contract.id, "RECHAZAR")} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50">Rechazar</button></div></article>)}</div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-xl font-black text-navy">Propiedades</h3><div className="mt-4 space-y-3">{properties.map((property) => <article key={property.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"><div><p className="font-bold text-navy">{property.title}</p><p className="text-sm text-slate-500">{property.address} · ${property.monthlyRent}/mes</p><p className="mt-1 text-xs text-slate-500">Arrendador: {property.users_properties_landlordIdTousers.fullName} · {property.users_properties_landlordIdTousers.email}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${property.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{property.approved ? "Aprobada" : "Pendiente"}</span><button onClick={() => void approveProperty(property.id, !property.approved)} className="rounded-lg bg-blue px-3 py-2 text-sm font-bold text-white">{property.approved ? "Retirar" : "Aprobar"}</button></div></article>)}{properties.length === 0 ? <p className="text-slate-500">No hay propiedades registradas.</p> : null}</div></div>
  </section>;
}
