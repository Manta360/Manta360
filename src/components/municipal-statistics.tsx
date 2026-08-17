"use client";

import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, ErrorState, LoadingState, StatCard, StatusBadge } from "@/components/ui";

export type MunicipalStatisticsData = {
  propertiesByZone: Array<{ zone: string; count: number }>;
  averageRentByZone: Array<{ zone: string; averageRent: number }>;
  incidentsByStatus: { PENDIENTE: number; EN_PROCESO: number; RESUELTO: number };
  topLandlords: Array<{ id: string; fullName: string; active: boolean; propertiesCount: number }>;
};
type Props = { data: MunicipalStatisticsData | null; loading: boolean; error: string | null };
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusColors = { PENDIENTE: "#d99100", EN_PROCESO: "#1672d4", RESUELTO: "#188754" };

export function municipalInsights(data: MunicipalStatisticsData): string[] {
  const busiest = [...data.propertiesByZone].sort((a, b) => b.count - a.count)[0];
  const highestRent = [...data.averageRentByZone].sort((a, b) => b.averageRent - a.averageRent)[0];
  const open = data.incidentsByStatus.PENDIENTE + data.incidentsByStatus.EN_PROCESO;
  return [busiest ? `${busiest.zone} concentra la mayor cantidad de propiedades registradas.` : "Aún no hay propiedades clasificadas por zona.", open === 0 ? "No existen incidencias pendientes actualmente." : `${open} incidencia(s) siguen en atención.`, highestRent ? `La renta promedio más alta corresponde a ${highestRent.zone}.` : "Aún no hay rentas disponibles para comparar."];
}

function ChartTooltip({ active, payload, label, money = false }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-lg"><p className="font-bold text-navy">{label}</p><p className="mt-1 text-primary">{money ? currency.format(Number(payload[0]?.value ?? 0)) : `${payload[0]?.value ?? 0} propiedades`}</p></div>;
}

export function MunicipalStatistics({ data, loading, error }: Props) {
  if (loading) return <LoadingState title="Cargando estadísticas" description="Estamos calculando el panorama municipal." />;
  if (error) return <ErrorState title="No se pudieron cargar las estadísticas" description={error} />;
  if (!data) return <EmptyState title="No hay datos disponibles" description="Las estadísticas aparecerán cuando existan registros para analizar." />;
  const totalProperties = data.propertiesByZone.reduce((total, item) => total + item.count, 0);
  const weightedRent = data.averageRentByZone.reduce((total, item) => total + item.averageRent * (data.propertiesByZone.find((zone) => zone.zone === item.zone)?.count ?? 0), 0);
  const averageRent = totalProperties ? weightedRent / totalProperties : 0;
  const openIncidents = data.incidentsByStatus.PENDIENTE + data.incidentsByStatus.EN_PROCESO;
  const incidents = Object.entries(data.incidentsByStatus).map(([name, value]) => ({ name: name === "EN_PROCESO" ? "En proceso" : `${name.slice(0, 1)}${name.slice(1).toLowerCase()}`, value, color: statusColors[name as keyof typeof statusColors] }));
  const maxLandlordProperties = Math.max(...data.topLandlords.map((landlord) => landlord.propertiesCount), 1);
  return <section className="space-y-5"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-sky">Análisis global</p><h3 className="mt-2 text-2xl font-black text-navy">Estadísticas municipales</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Indicadores de propiedades aprobadas, renta, incidencias y arrendadores.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Propiedades" value={totalProperties} detail="Aprobadas y habilitadas" tone="sky" /><StatCard label="Renta promedio" value={currency.format(averageRent)} detail="Promedio ponderado" tone="blue" /><StatCard label="Incidencias abiertas" value={openIncidents} detail="Pendientes y en proceso" tone="orange" /><StatCard label="Arrendadores" value={data.topLandlords.length} detail="Con actividad registrada" tone="blue" /></div>
    <div className="grid gap-5 xl:grid-cols-2"><article className="app-card p-5"><h4 className="text-lg font-black text-navy">Propiedades por zona</h4><p className="mt-1 text-sm text-muted-foreground">Solo propiedades aprobadas y habilitadas.</p>{data.propertiesByZone.length ? <div className="mt-5 h-72" aria-label="Gráfico de propiedades por zona"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.propertiesByZone} margin={{ top: 8, right: 8, bottom: 8, left: -20 }}><XAxis dataKey="zone" tick={{ fontSize: 12 }} interval={0} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="count" fill="#1672d4" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState className="mt-4" title="Sin propiedades clasificadas" />}</article>
      <article className="app-card p-5"><h4 className="text-lg font-black text-navy">Renta promedio por zona</h4><p className="mt-1 text-sm text-muted-foreground">Canon mensual de las propiedades incluidas.</p>{data.averageRentByZone.length ? <div className="mt-5 h-72" aria-label="Gráfico de renta promedio por zona"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.averageRentByZone} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}><XAxis dataKey="zone" tick={{ fontSize: 12 }} interval={0} /><YAxis tickFormatter={(value) => `$${value}`} tick={{ fontSize: 12 }} width={54} /><Tooltip content={<ChartTooltip money />} /><Bar dataKey="averageRent" fill="#0d3b66" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState className="mt-4" title="Sin rentas para promediar" />}</article>
      <article className="app-card p-5"><h4 className="text-lg font-black text-navy">Incidencias por estado</h4>{incidents.some((item) => item.value > 0) ? <div className="mt-3 grid items-center gap-4 sm:grid-cols-2"><div className="h-56" aria-label="Gráfico de incidencias por estado"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={incidents} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>{incidents.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div><div className="space-y-2">{incidents.map((item) => <div key={item.name} className="flex items-center justify-between rounded-lg bg-surface-subtle px-3 py-2"><span className="flex items-center gap-2 text-sm font-bold text-navy"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-black text-navy">{item.value}</span></div>)}</div></div> : <EmptyState className="mt-4" title="No hay incidencias registradas." description="Pendiente 0 · En proceso 0 · Resuelto 0" />}</article>
      <article className="app-card p-5"><h4 className="text-lg font-black text-navy">Top arrendadores</h4><p className="mt-1 text-sm text-muted-foreground">Ranking por propiedades registradas.</p><div className="mt-5 space-y-3">{data.topLandlords.length ? data.topLandlords.slice(0, 5).map((landlord, index) => <div key={landlord.id}><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy text-xs font-black text-white">{index + 1}</span><span className="truncate text-sm font-bold text-navy">{landlord.fullName}</span><StatusBadge status={landlord.active ? "ACTIVO" : "INHABILITADO"} /></div><span className="shrink-0 text-sm font-black text-primary">{landlord.propertiesCount} prop.</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-blue" style={{ width: `${(landlord.propertiesCount / maxLandlordProperties) * 100}%` }} /></div></div>) : <EmptyState title="No hay arrendadores registrados" />}</div></article></div>
    <section className="app-panel border-sky/20 bg-sky/5 p-5"><h4 className="font-black text-navy">Resumen de los datos</h4><ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">{municipalInsights(data).map((insight) => <li key={insight}>• {insight}</li>)}</ul></section>
  </section>;
}
