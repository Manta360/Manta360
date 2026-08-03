"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter(); const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "No se pudo iniciar sesión"); return; }
      const next = searchParams.get("next"); router.push(next && next.startsWith("/panel") ? next : data.redirectTo); router.refresh();
    } catch { setError("No se pudo conectar con el servidor. Intenta nuevamente."); } finally { setLoading(false); }
  }
  return <form onSubmit={onSubmit} className="space-y-5" noValidate>
    <label className="block space-y-2"><span className="text-sm font-semibold text-navy">Correo electrónico</span><input name="email" type="email" required autoComplete="email" placeholder="tu@correo.com" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-navy outline-none transition placeholder:text-slate-400 focus:border-sky focus:ring-4 focus:ring-sky/15" /></label>
    <label className="block space-y-2"><span className="text-sm font-semibold text-navy">Contraseña</span><input name="password" type="password" required autoComplete="current-password" placeholder="Ingresa tu contraseña" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-navy outline-none transition placeholder:text-slate-400 focus:border-sky focus:ring-4 focus:ring-sky/15" /></label>
    {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
    <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue px-5 py-3.5 font-bold text-white shadow-md shadow-blue/20 transition hover:-translate-y-0.5 hover:bg-navy disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Iniciando sesión..." : "Iniciar sesión"}</button>
  </form>;
}
