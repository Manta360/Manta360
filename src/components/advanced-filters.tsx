"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui";

export type PropertyFilters = { minPrice: string; maxPrice: string; services: string[]; radius: string };
type AdvancedFiltersProps = { onApply?: (filters: PropertyFilters) => void };

const serviceOptions = ["Agua", "Luz", "Internet", "Piscina", "Seguridad Privada", "Wi-Fi", "Parqueo"];

export function AdvancedFilters({ onApply }: AdvancedFiltersProps) {
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [radius, setRadius] = useState("city");

  function toggleService(service: string) { setServices((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service]); }
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onApply?.({ minPrice, maxPrice, services, radius }); }

  return <form onSubmit={handleSubmit} className="app-panel p-4 sm:p-5">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h3 className="font-black text-navy">Filtra el catálogo</h3><p className="mt-1 text-sm text-muted-foreground">Combina presupuesto, servicios y cercanía.</p></div><span className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Filtros locales</span></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(280px,1fr)_190px_auto] xl:items-end">
      <fieldset><legend className="mb-2 text-xs font-extrabold uppercase tracking-wide text-navy">Precio mensual</legend><div className="grid grid-cols-2 gap-2"><label className="sr-only" htmlFor="minimum-price">Precio mínimo</label><input id="minimum-price" type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Mínimo $" className="field-input min-w-0 px-3 py-2 text-sm" /><label className="sr-only" htmlFor="maximum-price">Precio máximo</label><input id="maximum-price" type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Máximo $" className="field-input min-w-0 px-3 py-2 text-sm" /></div></fieldset>
      <fieldset><legend className="mb-2 text-xs font-extrabold uppercase tracking-wide text-navy">Servicios y comodidades</legend><div className="flex flex-wrap gap-2">{serviceOptions.map((service) => <button key={service} type="button" onClick={() => toggleService(service)} aria-pressed={services.includes(service)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25 ${services.includes(service) ? "border-sky bg-sky text-white" : "border-slate-300 bg-white text-slate-600 hover:border-sky hover:text-blue"}`}>{service}</button>)}</div></fieldset>
      <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-navy">Cercanía</span><select value={radius} onChange={(event) => setRadius(event.target.value)} className="field-input px-3 py-2 text-sm"><option value="1">A menos de 1 km</option><option value="3">A menos de 3 km</option><option value="5">A menos de 5 km</option><option value="city">Toda la ciudad</option></select></label>
      <Button type="submit" variant="accent" className="w-full xl:w-auto">Aplicar filtros</Button>
    </div>
  </form>;
}
