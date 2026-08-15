"use client";

import { FormEvent, useEffect, useState } from "react";
import { MunicipalStatistics, type MunicipalStatisticsData } from "@/components/municipal-statistics";

type Property = {
  id: string;
  title: string;
  address: string;
  monthlyRent: number;
  approved: boolean;
  status: string;
  users_properties_landlordIdTousers: { fullName: string; email: string };
};
type Landlord = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  nationalId: string | null;
  active: boolean;
  disabledAt: string | null;
  disableReason: string | null;
  createdAt: string;
  updatedAt: string;
  propertiesCount: number;
};
type LandlordForm = {
  fullName: string;
  email: string;
  phone: string;
  nationalId: string;
  password: string;
};
type Stats = { users: number; pendingProperties: number; occupiedProperties: number; activeContracts: number; disabledLandlords?: number; disabledProperties?: number };
type DisableTarget = { type: "PROPERTY" | "USER"; id: string; label: string };
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

const emptyLandlordForm: LandlordForm = {
  fullName: "",
  email: "",
  phone: "",
  nationalId: "",
  password: "",
};

export function SuperadminDashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [municipalStatistics, setMunicipalStatistics] = useState<MunicipalStatisticsData | null>(null);
  const [municipalStatisticsLoading, setMunicipalStatisticsLoading] = useState(true);
  const [municipalStatisticsError, setMunicipalStatisticsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<DisableTarget | null>(null);
  const [disableReasonText, setDisableReasonText] = useState("");
  const [disableSubmitting, setDisableSubmitting] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [enableTarget, setEnableTarget] = useState<DisableTarget | null>(null);
  const [enableSubmitting, setEnableSubmitting] = useState(false);
  const [selectedLandlord, setSelectedLandlord] = useState<Landlord | null>(null);
  const [editingLandlord, setEditingLandlord] = useState<Landlord | null>(null);
  const [landlordFormOpen, setLandlordFormOpen] = useState(false);
  const [landlordForm, setLandlordForm] = useState<LandlordForm>(emptyLandlordForm);
  const [landlordSubmitting, setLandlordSubmitting] = useState(false);

  const load = async () => {
    const [propertyResponse, contractResponse, landlordResponse] = await Promise.all([fetch("/api/admin/properties"), fetch("/api/contracts"), fetch("/api/admin/users")]);
    const [propertyData, contractData, landlordData] = await Promise.all([propertyResponse.json(), contractResponse.json(), landlordResponse.json()]);
    if (!propertyResponse.ok) {
      setError(propertyData.error ?? "No se pudo cargar el panel");
      return;
    }
    if (!contractResponse.ok) {
      setError(contractData.error ?? "No se pudieron cargar los contratos");
      return;
    }
    if (!landlordResponse.ok) {
      setError(landlordData.error ?? "No se pudieron cargar los arrendadores");
      return;
    }
    setProperties(propertyData.properties ?? []);
    setStats(propertyData.stats ?? null);
    setContracts(contractData.contracts ?? []);
    setLandlords(landlordData.landlords ?? []);
  };

  const loadMunicipalStatistics = async () => {
    setMunicipalStatisticsLoading(true);
    setMunicipalStatisticsError(null);
    try {
      const response = await fetch("/api/admin/stats");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar las estadísticas");
      setMunicipalStatistics(data);
    } catch (statisticsError) {
      setMunicipalStatisticsError(statisticsError instanceof Error ? statisticsError.message : "No se pudieron cargar las estadísticas");
    } finally {
      setMunicipalStatisticsLoading(false);
    }
  };

  const refreshDashboard = async () => {
    await Promise.all([load(), loadMunicipalStatistics()]);
  };

  // The dashboard is loaded once on mount; subsequent refreshes follow successful admin actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refreshDashboard(); }, []);
  useEffect(() => {
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setDisableTarget(null);
      setEnableTarget(null);
      setSelectedLandlord(null);
    }
    if (!disableTarget && !enableTarget && !selectedLandlord) return;
    document.addEventListener("keydown", closeWithEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeWithEscape);
      document.body.style.overflow = "";
    };
  }, [disableTarget, enableTarget, selectedLandlord]);

  const openLandlordCreate = () => {
    setEditingLandlord(null);
    setLandlordForm(emptyLandlordForm);
    setLandlordFormOpen(true);
    setError(null);
  };

  const openLandlordEdit = (landlord: Landlord) => {
    setEditingLandlord(landlord);
    setLandlordForm({
      fullName: landlord.fullName,
      email: landlord.email,
      phone: landlord.phone ?? "",
      nationalId: landlord.nationalId ?? "",
      password: "",
    });
    setLandlordFormOpen(true);
    setSelectedLandlord(null);
    setError(null);
  };

  const viewLandlord = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo consultar el arrendador");
      setSelectedLandlord(data.landlord);
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "No se pudo consultar el arrendador");
    } finally {
      setBusy(null);
    }
  };

  const submitLandlord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLandlordSubmitting(true);
    setError(null);
    try {
      const payload = editingLandlord
        ? {
            fullName: landlordForm.fullName,
            email: landlordForm.email,
            phone: landlordForm.phone,
            nationalId: landlordForm.nationalId,
          }
        : landlordForm;
      const response = await fetch(
        editingLandlord ? `/api/admin/users/${editingLandlord.id}` : "/api/admin/users",
        {
          method: editingLandlord ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el arrendador");
      setLandlordFormOpen(false);
      setEditingLandlord(null);
      setLandlordForm(emptyLandlordForm);
      await refreshDashboard();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el arrendador");
    } finally {
      setLandlordSubmitting(false);
    }
  };

  const openDisableModal = (type: DisableTarget["type"], id: string, label: string) => {
    setDisableTarget({ type, id, label });
    setDisableReasonText("");
    setDisableError(null);
  };

  const openEnableModal = (type: DisableTarget["type"], id: string, label: string) => {
    setEnableTarget({ type, id, label });
  };

  const confirmDisable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!disableTarget) return;
    const reason = disableReasonText.trim();
    if (reason.length < 10) {
      setDisableError("El motivo de inhabilitación debe tener al menos 10 caracteres");
      return;
    }
    setDisableSubmitting(true);
    setDisableError(null);
    try {
      const url = disableTarget.type === "PROPERTY" ? `/api/admin/properties/${disableTarget.id}/disable` : `/api/admin/users/${disableTarget.id}`;
      const body = disableTarget.type === "PROPERTY" ? { reason } : { active: false, reason };
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo completar la inhabilitación");
      setDisableTarget(null);
      await refreshDashboard();
    } catch (submitError) {
      setDisableError(submitError instanceof Error ? submitError.message : "No se pudo completar la inhabilitación");
    } finally {
      setDisableSubmitting(false);
    }
  };

  const confirmEnable = async () => {
    if (!enableTarget) return;
    setEnableSubmitting(true);
    setBusy(enableTarget.id);
    try {
      const url = enableTarget.type === "PROPERTY" ? `/api/admin/properties/${enableTarget.id}/enable` : `/api/admin/users/${enableTarget.id}`;
      const body = enableTarget.type === "PROPERTY" ? undefined : JSON.stringify({ active: true });
      const response = await fetch(url, {
        method: "PATCH",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "No se pudo rehabilitar el registro");
      setEnableTarget(null);
      await refreshDashboard();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo rehabilitar el registro");
      setEnableTarget(null);
    } finally {
      setEnableSubmitting(false);
      setBusy(null);
    }
  };

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
    await refreshDashboard();
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
    await refreshDashboard();
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
    <MunicipalStatistics data={municipalStatistics} loading={municipalStatisticsLoading} error={municipalStatisticsError} />
    <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-black text-navy">Contratos por revisar</h3><p className="mt-1 text-sm text-slate-600">Ambas partes ya firmaron. Tu aprobación formaliza el contrato y ocupa el inmueble.</p></div><span className="rounded-full bg-violet px-3 py-1 text-sm font-bold text-white">{pendingContracts.length} pendientes</span></div>
      <div className="mt-4 space-y-3">{pendingContracts.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No hay contratos esperando aprobación municipal.</p> : pendingContracts.map((contract) => <article key={contract.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-violet-100 bg-white p-4"><div><p className="font-bold text-navy">{contract.properties.title}</p><p className="text-sm text-slate-500">{contract.users_contracts_landlordIdTousers.fullName} ↔ {contract.users_contracts_tenantIdTousers.fullName}</p><p className="mt-1 text-xs text-slate-500">{new Date(contract.startDate).toLocaleDateString("es-EC")} a {new Date(contract.endDate).toLocaleDateString("es-EC")}</p></div><div className="flex gap-2"><button disabled={busy === contract.id} onClick={() => void reviewContract(contract.id, "APROBAR")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Aprobar contrato</button><button disabled={busy === contract.id} onClick={() => void reviewContract(contract.id, "RECHAZAR")} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50">Rechazar</button></div></article>)}</div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-xl font-black text-navy">Propiedades</h3><div className="mt-4 space-y-3">{properties.map((property) => <article key={property.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"><div><p className="font-bold text-navy">{property.title}</p><p className="text-sm text-slate-500">{property.address} · ${property.monthlyRent}/mes</p><p className="mt-1 text-xs text-slate-500">Arrendador: {property.users_properties_landlordIdTousers.fullName} · {property.users_properties_landlordIdTousers.email}</p></div><div className="flex flex-wrap items-center gap-3">{property.status === "INHABILITADO" ? <><span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Inhabilitada</span><button disabled={busy === property.id} onClick={() => openEnableModal("PROPERTY", property.id, property.title)} className="rounded-lg border border-emerald-500 px-3 py-2 text-sm font-bold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50">Rehabilitar</button></> : <><span className={`rounded-full px-3 py-1 text-xs font-bold ${property.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{property.approved ? "Aprobada" : "Pendiente"}</span><button disabled={busy === property.id} onClick={() => void approveProperty(property.id, !property.approved)} className="rounded-lg bg-blue px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{property.approved ? "Retirar" : "Aprobar"}</button><button onClick={() => openDisableModal("PROPERTY", property.id, property.title)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50">Inhabilitar</button></>}</div></article>)}{properties.length === 0 ? <p className="text-slate-500">No hay propiedades registradas.</p> : null}</div></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-navy">Gestión de arrendadores</h3>
          <p className="mt-1 text-sm text-slate-500">Crea, consulta, edita e inhabilita cuentas que incumplan las regulaciones del sistema.</p>
        </div>
        <button type="button" onClick={openLandlordCreate} className="rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#d85c13]">
          Nuevo arrendador
        </button>
      </div>
      {landlordFormOpen ? <form onSubmit={submitLandlord} className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <h4 className="sm:col-span-2 text-lg font-black text-navy">{editingLandlord ? "Editar arrendador" : "Crear arrendador"}</h4>
        <label className="space-y-1.5"><span className="text-sm font-bold text-navy">Nombre completo</span><input required minLength={3} maxLength={120} value={landlordForm.fullName} onChange={(event) => setLandlordForm({ ...landlordForm, fullName: event.target.value })} className="field-input" /></label>
        <label className="space-y-1.5"><span className="text-sm font-bold text-navy">Cédula</span><input required pattern="[0-9]{10}" maxLength={10} value={landlordForm.nationalId} onChange={(event) => setLandlordForm({ ...landlordForm, nationalId: event.target.value })} className="field-input" /></label>
        <label className="space-y-1.5"><span className="text-sm font-bold text-navy">Correo</span><input required type="email" maxLength={160} value={landlordForm.email} onChange={(event) => setLandlordForm({ ...landlordForm, email: event.target.value })} className="field-input" /></label>
        <label className="space-y-1.5"><span className="text-sm font-bold text-navy">Teléfono</span><input required minLength={7} maxLength={20} value={landlordForm.phone} onChange={(event) => setLandlordForm({ ...landlordForm, phone: event.target.value })} className="field-input" /></label>
        {!editingLandlord ? <label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-bold text-navy">Contraseña temporal</span><input required type="password" minLength={8} value={landlordForm.password} onChange={(event) => setLandlordForm({ ...landlordForm, password: event.target.value })} className="field-input" /><span className="text-xs text-slate-500">Debe incluir letras y números. Se almacena cifrada.</span></label> : null}
        <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={() => { setLandlordFormOpen(false); setEditingLandlord(null); setLandlordForm(emptyLandlordForm); }} className="rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Cancelar</button><button type="submit" disabled={landlordSubmitting} className="rounded-lg bg-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{landlordSubmitting ? "Guardando..." : "Guardar"}</button></div>
      </form> : null}
      <div className="mt-4 space-y-3">
        {landlords.map((landlord) => <article key={landlord.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
          <div><p className="font-bold text-navy">{landlord.fullName}</p><p className="text-sm text-slate-500">{landlord.email} · {landlord.phone || "Sin teléfono"}</p><p className="mt-1 text-xs text-slate-500">{landlord.propertiesCount} propiedades</p>{!landlord.active && landlord.disableReason ? <p className="mt-1 text-xs text-red-600">Motivo: {landlord.disableReason}</p> : null}</div>
          <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${landlord.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{landlord.active ? "Activo" : "Inhabilitado"}</span><button type="button" disabled={busy === landlord.id} onClick={() => void viewLandlord(landlord.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-navy disabled:opacity-50">Ver</button><button type="button" onClick={() => openLandlordEdit(landlord)} className="rounded-lg border border-blue px-3 py-2 text-sm font-bold text-blue">Editar</button>{landlord.active ? <button type="button" onClick={() => openDisableModal("USER", landlord.id, landlord.fullName)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50">Inhabilitar</button> : <button type="button" disabled={busy === landlord.id} onClick={() => openEnableModal("USER", landlord.id, landlord.fullName)} className="rounded-lg border border-emerald-500 px-3 py-2 text-sm font-bold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50">Rehabilitar</button>}</div>
        </article>)}
        {landlords.length === 0 ? <p className="text-slate-500">No hay arrendadores registrados.</p> : null}
      </div>
    </div>
    {selectedLandlord ? <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedLandlord(null); }}><div role="dialog" aria-modal="true" aria-labelledby="landlord-detail-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-sky">Detalle administrativo</p><h4 id="landlord-detail-title" className="mt-2 text-2xl font-black text-navy">{selectedLandlord.fullName}</h4></div><button type="button" onClick={() => setSelectedLandlord(null)} aria-label="Cerrar" className="text-2xl font-bold text-slate-500">×</button></div><dl className="mt-5 space-y-3 text-sm"><div><dt className="font-bold text-slate-500">Correo</dt><dd>{selectedLandlord.email}</dd></div><div><dt className="font-bold text-slate-500">Teléfono</dt><dd>{selectedLandlord.phone || "Sin teléfono"}</dd></div><div><dt className="font-bold text-slate-500">Cédula</dt><dd>{selectedLandlord.nationalId || "Sin cédula"}</dd></div><div><dt className="font-bold text-slate-500">Estado</dt><dd>{selectedLandlord.active ? "Activo" : "Inhabilitado"}</dd></div><div><dt className="font-bold text-slate-500">Creado</dt><dd>{new Date(selectedLandlord.createdAt).toLocaleDateString("es-EC")}</dd></div>{selectedLandlord.disabledAt ? <div><dt className="font-bold text-slate-500">Inhabilitado</dt><dd>{new Date(selectedLandlord.disabledAt).toLocaleDateString("es-EC")}</dd></div> : null}{selectedLandlord.disableReason ? <div><dt className="font-bold text-slate-500">Motivo</dt><dd>{selectedLandlord.disableReason}</dd></div> : null}</dl></div></div> : null}
    {disableTarget ? <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setDisableTarget(null); }}><div role="dialog" aria-modal="true" aria-labelledby="disable-modal-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-red-600">{disableTarget.type === "PROPERTY" ? "Propiedad" : "Arrendador"}</p><h2 id="disable-modal-title" className="mt-2 text-2xl font-black text-navy">Confirmar inhabilitación</h2><p className="mt-2 text-sm text-slate-500">Sobre: {disableTarget.label}</p></div><button type="button" aria-label="Cerrar" onClick={() => setDisableTarget(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xl font-bold text-navy">×</button></div><form onSubmit={confirmDisable} className="mt-6 space-y-4"><label className="block space-y-2"><span className="text-sm font-bold text-navy">Motivo legal de la inhabilitación</span><textarea required minLength={10} maxLength={800} rows={4} value={disableReasonText} onChange={(event) => setDisableReasonText(event.target.value)} placeholder="Describe el incumplimiento de las regulaciones del sistema (mínimo 10 caracteres)..." className="field-input resize-y" /></label>{disableError ? <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{disableError}</p> : null}<div className="flex justify-end gap-3"><button type="button" onClick={() => setDisableTarget(null)} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200">Cancelar</button><button type="submit" disabled={disableSubmitting} className="rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60">{disableSubmitting ? "Inhabilitando..." : "Confirmar inhabilitación"}</button></div></form></div></div> : null}
    {enableTarget ? <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setEnableTarget(null); }}><div role="dialog" aria-modal="true" aria-labelledby="enable-modal-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-emerald-600">{enableTarget.type === "PROPERTY" ? "Propiedad" : "Arrendador"}</p><h2 id="enable-modal-title" className="mt-2 text-2xl font-black text-navy">Confirmar rehabilitación</h2><p className="mt-2 text-sm text-slate-500">Sobre: {enableTarget.label}</p></div><button type="button" aria-label="Cerrar" onClick={() => setEnableTarget(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xl font-bold text-navy">×</button></div><p className="mt-6 text-sm text-slate-600">¿Estás seguro de que deseas habilitar nuevamente este registro en el sistema?</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEnableTarget(null)} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200">Cancelar</button><button type="button" disabled={enableSubmitting} onClick={() => void confirmEnable()} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">{enableSubmitting ? "Rehabilitando..." : "Confirmar"}</button></div></div></div> : null}
  </section>;
}
