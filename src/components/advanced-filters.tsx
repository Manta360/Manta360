"use client";

import { FormEvent, useState } from "react";

export type PropertyFilters = {
  minPrice: string;
  maxPrice: string;
  services: string[];
  radius: string;
};

type AdvancedFiltersProps = {
  onApply?: (filters: PropertyFilters) => void;
};

const serviceOptions = ["Agua", "Luz", "Internet", "Piscina", "Seguridad Privada", "Wi-Fi", "Parqueo"];

export function AdvancedFilters({ onApply }: AdvancedFiltersProps) {
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [radius, setRadius] = useState("city");

  function toggleService(service: string) {
    setServices((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const filters = { minPrice, maxPrice, services, radius };
    onApply?.(filters);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl bg-white p-4 shadow-md shadow-slate-200/70">
      <div className="grid gap-4 xl:grid-cols-[180px_minmax(280px,1fr)_190px_auto] xl:items-end">
        <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">Precio mensual</legend><div className="flex gap-2"><input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Min. $" aria-label="Precio mínimo" className="field-input min-w-0 px-3 py-2 text-sm" /><input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Max. $" aria-label="Precio máximo" className="field-input min-w-0 px-3 py-2 text-sm" /></div></fieldset>
        <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">Servicios</legend><div className="flex flex-wrap gap-2">{serviceOptions.map((service) => <button key={service} type="button" onClick={() => toggleService(service)} aria-pressed={services.includes(service)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${services.includes(service) ? "border-sky bg-sky text-white" : "border-slate-300 text-slate-600 hover:border-sky hover:text-blue"}`}>{service}</button>)}</div></fieldset>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-navy">Cercanía</span><select value={radius} onChange={(event) => setRadius(event.target.value)} className="field-input px-3 py-2 text-sm"><option value="1">A menos de 1 km</option><option value="3">A menos de 3 km</option><option value="5">A menos de 5 km</option><option value="city">Toda la ciudad</option></select></label>
        <button type="submit" className="rounded-xl bg-orange px-5 py-3 text-sm font-bold text-white shadow-md shadow-orange/20 transition hover:-translate-y-0.5 hover:bg-[#d85c13]">Aplicar Filtros</button>
      </div>
    </form>
  );
}
