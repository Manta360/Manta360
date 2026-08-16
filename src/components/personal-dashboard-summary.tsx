"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui";

type Data = {
  user: { fullName: string; email: string; phone?: string | null; nationalId?: string | null };
  cards: { label: string; value: number }[];
};

export function PersonalDashboardSummary() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/my-dashboard")
      .then(async (response) => response.ok ? response.json() : null)
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return <section aria-label="Cargando resumen personal" className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="skeleton h-28 rounded-2xl" />)}</section>;

  return <section className="app-panel overflow-hidden p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-sm font-black text-navy">Tu espacio personal</p><p className="mt-1 text-sm text-slate-600">{data.user.email}{data.user.phone ? ` · ${data.user.phone}` : ""}</p></div>
      <span className="rounded-full bg-sky/10 px-3 py-1 text-xs font-bold text-blue">Información privada</span>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">{data.cards.map((card, index) => <StatCard key={card.label} label={card.label} value={card.value} tone={index === 0 ? "sky" : index === 1 ? "blue" : "violet"} />)}</div>
  </section>;
}
