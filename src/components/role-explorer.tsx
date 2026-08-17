"use client";

import Link from "next/link";
import { useState } from "react";

const roles = [
  { id: "tenant", title: "Arrendatario", goal: "Encuentra un hogar y conversa directamente con el propietario.", steps: ["Explora el catálogo público", "Valida tu identidad", "Conversa y solicita tu contrato"], href: "/registro" },
  { id: "landlord", title: "Arrendador", goal: "Publica un inmueble con respaldo municipal.", steps: ["Valida tu identidad", "Carga fotos y ubicación", "Responde y formaliza"], href: "/registro" },
  { id: "city", title: "Municipio", goal: "Da confianza verificando usuarios y publicaciones.", steps: ["Revisa documentos", "Aprueba propiedades", "Supervisa contratos"], href: "/login" },
];

export function RoleExplorer() {
  const [selected, setSelected] = useState(roles[0]);
  return <section aria-labelledby="role-journey-title" className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-sky">Recorridos por rol</p><h2 id="role-journey-title" className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-3xl">Conoce el recorrido que necesitas.</h2></div><div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Seleccionar recorrido">{roles.map((role) => <button key={role.id} role="tab" aria-selected={selected.id === role.id} onClick={() => setSelected(role)} className={`shrink-0 rounded-md border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25 ${selected.id === role.id ? "border-primary bg-primary text-white" : "border-border bg-surface text-muted hover:border-sky hover:text-primary"}`}>{role.title}</button>)}</div><article className="mt-5 grid gap-6 border-t border-border pt-6 lg:grid-cols-[.9fr_1.1fr] lg:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">{selected.title}</p><h3 className="mt-2 text-xl font-semibold leading-7 text-navy">{selected.goal}</h3><Link href={selected.href} className="mt-5 inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy">Comenzar →</Link></div><ol className="grid gap-3 sm:grid-cols-3">{selected.steps.map((step, index) => <li key={step} className="rounded-lg border border-border bg-surface-subtle/60 p-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-sky/15 text-xs font-semibold text-primary">{index + 1}</span><p className="mt-3 text-sm font-medium leading-6 text-navy">{step}</p></li>)}</ol></article></section>;
}
