"use client";

import { FormEvent, useEffect, useState } from "react";

type Tenant = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  nationalId: string | null;
  active: boolean;
  createdAt: string;
  disabledAt: string | null;
  disableReason: string | null;
  contractsCount?: number;
  requestsCount?: number;
};

type FormValues = { fullName: string; nationalId: string; email: string; phone: string; password: string };

const emptyForm: FormValues = { fullName: "", nationalId: "", email: "", phone: "", password: "" };

export function TenantManagementPanel() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tenants", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar los arrendatarios");
      setTenants(data.tenants ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los arrendatarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
    setSelected(null);
    setForm(emptyForm);
    setError(null);
    setSuccess(null);
  };

  const openEdit = (tenant: Tenant) => {
    setEditing(tenant);
    setFormOpen(true);
    setSelected(null);
    setForm({ fullName: tenant.fullName, nationalId: tenant.nationalId ?? "", email: tenant.email, phone: tenant.phone ?? "", password: "" });
    setError(null);
    setSuccess(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = editing
        ? { fullName: form.fullName, nationalId: form.nationalId, email: form.email, phone: form.phone }
        : { ...form };
      const response = await fetch(editing ? `/api/tenants/${editing.id}` : "/api/tenants", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el arrendatario");
      setSuccess(editing ? "Arrendatario actualizado correctamente." : "Arrendatario creado correctamente.");
      setEditing(null);
      setFormOpen(false);
      setForm(emptyForm);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el arrendatario");
    } finally {
      setSubmitting(false);
    }
  };

  const deactivate = async (tenant: Tenant) => {
    if (!window.confirm(`¿Está seguro de que desea desactivar a ${tenant.fullName}?`)) return;
    setBusyId(tenant.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/tenants/${tenant.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Desactivado por gestión municipal" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo desactivar el arrendatario");
      setSuccess("Arrendatario desactivado. Sus contratos y solicitudes fueron conservados.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo desactivar el arrendatario");
    } finally {
      setBusyId(null);
    }
  };

  const reactivate = async (tenant: Tenant) => {
    setBusyId(tenant.id);
    setError(null);
    try {
      const response = await fetch(`/api/tenants/${tenant.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo reactivar el arrendatario");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo reactivar el arrendatario");
    } finally {
      setBusyId(null);
    }
  };

  return <section className="rounded-2xl border border-sky/20 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h3 className="text-xl font-black text-navy">Gestión de arrendatarios</h3><p className="mt-1 text-sm text-slate-500">Crea, consulta, edita y desactiva cuentas sin borrar sus contratos ni solicitudes.</p></div>
      <button type="button" onClick={openCreate} className="rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#d85c13]">Nuevo arrendatario</button>
    </div>
    {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
    {success ? <p role="status" className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{success}</p> : null}
    {formOpen ? <form onSubmit={submit} className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
      <h4 className="sm:col-span-2 text-lg font-black text-navy">{editing ? "Editar arrendatario" : "Crear arrendatario"}</h4>
      <label className="space-y-1.5"><span className="text-sm font-bold text-navy">Nombre completo</span><input required minLength={3} maxLength={120} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="field-input" /></label>
      <label className="space-y-1.5"><span className="text-sm font-bold text-navy">Cédula</span><input required pattern="[0-9]{10}" maxLength={10} value={form.nationalId} onChange={(event) => setForm({ ...form, nationalId: event.target.value })} className="field-input" /></label>
      <label className="space-y-1.5"><span className="text-sm font-bold text-navy">Correo</span><input required type="email" maxLength={160} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="field-input" /></label>
      <label className="space-y-1.5"><span className="text-sm font-bold text-navy">Teléfono</span><input required minLength={7} maxLength={20} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="field-input" /></label>
      {!editing ? <label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-bold text-navy">Contraseña temporal</span><input required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="field-input" /><span className="text-xs text-slate-500">Debe incluir letras y números. Se almacena cifrada.</span></label> : null}
      <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={() => { setEditing(null); setFormOpen(false); setForm(emptyForm); }} className="rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Cancelar</button><button type="submit" disabled={submitting} className="rounded-lg bg-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{submitting ? "Guardando..." : "Guardar"}</button></div>
    </form> : null}
    <div className="mt-5 space-y-3">
      {loading ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Cargando arrendatarios...</p> : null}
      {!loading && tenants.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No hay arrendatarios registrados.</p> : null}
      {tenants.map((tenant) => <article key={tenant.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
        <div><p className="font-bold text-navy">{tenant.fullName}</p><p className="text-sm text-slate-500">{tenant.email} · {tenant.phone || "Sin teléfono"}</p><p className="mt-1 text-xs text-slate-500">{tenant.contractsCount ?? 0} contratos · {tenant.requestsCount ?? 0} solicitudes</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${tenant.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{tenant.active ? "Activo" : "Desactivado"}</span><button type="button" onClick={() => setSelected(tenant)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-navy">Ver</button><button type="button" onClick={() => openEdit(tenant)} className="rounded-lg border border-blue px-3 py-2 text-sm font-bold text-blue">Editar</button>{tenant.active ? <button type="button" disabled={busyId === tenant.id} onClick={() => void deactivate(tenant)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-600 disabled:opacity-50">{busyId === tenant.id ? "..." : "Desactivar"}</button> : <button type="button" disabled={busyId === tenant.id} onClick={() => void reactivate(tenant)} className="rounded-lg border border-emerald-500 px-3 py-2 text-sm font-bold text-emerald-600 disabled:opacity-50">Reactivar</button>}</div>
      </article>)}
    </div>
    {selected ? <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-sky">Detalle</p><h4 className="mt-2 text-2xl font-black text-navy">{selected.fullName}</h4></div><button type="button" onClick={() => setSelected(null)} aria-label="Cerrar" className="text-2xl font-bold text-slate-500">×</button></div><dl className="mt-5 space-y-3 text-sm"><div><dt className="font-bold text-slate-500">Correo</dt><dd className="text-navy">{selected.email}</dd></div><div><dt className="font-bold text-slate-500">Cédula</dt><dd className="text-navy">{selected.nationalId || "No registrada"}</dd></div><div><dt className="font-bold text-slate-500">Teléfono</dt><dd className="text-navy">{selected.phone || "No registrado"}</dd></div><div><dt className="font-bold text-slate-500">Estado</dt><dd className="text-navy">{selected.active ? "Activo" : `Desactivado${selected.disableReason ? `: ${selected.disableReason}` : ""}`}</dd></div></dl></div></div> : null}
  </section>;
}
