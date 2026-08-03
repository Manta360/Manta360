"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PUBLIC_REGISTER_ROLES, ROLE_LABELS } from "@/lib/roles";
type FieldErrors = Partial<Record<string, string[]>>;

export function RegisterForm() {
  const router = useRouter(); const [error, setError] = useState<string | null>(null); const [fieldErrors, setFieldErrors] = useState<FieldErrors>({}); const [loading, setLoading] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null); setFieldErrors({});
    try { const form = new FormData(event.currentTarget); const payload = { fullName: String(form.get("fullName") ?? ""), email: String(form.get("email") ?? ""), phone: String(form.get("phone") ?? ""), password: String(form.get("password") ?? ""), role: String(form.get("role") ?? "") };
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json();
      if (!response.ok) { setError(data.error ?? "No se pudo registrar"); setFieldErrors(data.details ?? {}); return; } router.push(data.redirectTo); router.refresh();
    } catch { setError("No se pudo conectar con el servidor. Intenta nuevamente."); } finally { setLoading(false); }
  }
  return <form onSubmit={onSubmit} className="space-y-4" noValidate>
    <Field label="Nombre completo" name="fullName" autoComplete="name" required errors={fieldErrors.fullName} />
    <Field label="Correo electrónico" name="email" type="email" autoComplete="email" required errors={fieldErrors.email} />
    <Field label="Teléfono (opcional)" name="phone" type="tel" autoComplete="tel" errors={fieldErrors.phone} />
    <Field label="Contraseña" name="password" type="password" autoComplete="new-password" required errors={fieldErrors.password} hint="Mínimo 8 caracteres, con letras y números" />
    <fieldset className="space-y-2"><legend className="text-sm font-semibold text-navy">¿Cómo usarás Manta360? <span className="text-orange">*</span></legend><p className="text-xs text-slate-500">Elige el rol que mejor te representa.</p><div className="grid gap-3 sm:grid-cols-2">{PUBLIC_REGISTER_ROLES.map((role) => <label key={role} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-navy transition hover:border-sky has-[:checked]:border-blue has-[:checked]:bg-blue/5"><input type="radio" name="role" value={role} required className="accent-blue" /><span>{ROLE_LABELS[role]}</span></label>)}</div>{fieldErrors.role?.[0] ? <p className="text-sm text-red-700">{fieldErrors.role[0]}</p> : null}</fieldset>
    {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
    <button type="submit" disabled={loading} className="w-full rounded-xl bg-orange px-5 py-3.5 font-bold text-white shadow-md shadow-orange/20 transition hover:-translate-y-0.5 hover:bg-[#d85c13] disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Creando cuenta..." : "Crear cuenta"}</button>
  </form>;
}
function Field({ label, name, type = "text", required, autoComplete, errors, hint }: { label: string; name: string; type?: string; required?: boolean; autoComplete?: string; errors?: string[]; hint?: string }) {
  return <label className="block space-y-1.5"><span className="text-sm font-semibold text-navy">{label}{required ? <span className="text-orange"> *</span> : null}</span><input name={name} type={type} required={required} autoComplete={autoComplete} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-navy outline-none transition placeholder:text-slate-400 focus:border-sky focus:ring-4 focus:ring-sky/15" />{hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}{errors?.[0] ? <span className="block text-sm text-red-700">{errors[0]}</span> : null}</label>;
}
