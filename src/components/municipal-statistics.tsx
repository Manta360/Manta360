export type MunicipalStatisticsData = {
  propertiesByZone: Array<{ zone: string; count: number }>;
  averageRentByZone: Array<{ zone: string; averageRent: number }>;
  incidentsByStatus: {
    PENDIENTE: number;
    EN_PROCESO: number;
    RESUELTO: number;
  };
  topLandlords: Array<{
    id: string;
    fullName: string;
    active: boolean;
    propertiesCount: number;
  }>;
};

type Props = {
  data: MunicipalStatisticsData | null;
  loading: boolean;
  error: string | null;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function ZoneBars({ items }: { items: MunicipalStatisticsData["propertiesByZone"] }) {
  const maximum = Math.max(...items.map((item) => item.count), 1);

  return <div className="mt-4 space-y-3">
    {items.map((item) => <div key={item.zone}>
      <div className="flex items-center justify-between gap-4 text-sm"><span className="font-bold text-navy">{item.zone}</span><span className="font-semibold text-slate-600">{item.count}</span></div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue" style={{ width: `${(item.count / maximum) * 100}%` }} /></div>
    </div>)}
  </div>;
}

export function MunicipalStatistics({ data, loading, error }: Props) {
  return <section className="rounded-2xl border border-sky/30 bg-sky/5 p-6">
    <div>
      <p className="text-sm font-bold uppercase tracking-[.18em] text-sky">Análisis global</p>
      <h3 className="mt-1 text-2xl font-black text-navy">Estadísticas municipales</h3>
      <p className="mt-1 text-sm text-slate-600">Resumen de propiedades aprobadas, incidencias y actividad histórica de arrendadores.</p>
    </div>

    {loading ? <p className="mt-5 rounded-xl bg-white p-4 text-sm text-slate-500">Cargando estadísticas municipales...</p> : null}
    {!loading && error ? <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">No se pudieron cargar las estadísticas: {error}</p> : null}
    {!loading && !error && !data ? <p className="mt-5 rounded-xl bg-white p-4 text-sm text-slate-500">No hay datos disponibles.</p> : null}

    {!loading && !error && data ? <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <article className="rounded-2xl bg-white p-5 shadow-sm">
        <h4 className="text-lg font-black text-navy">Propiedades por zona</h4>
        <p className="mt-1 text-sm text-slate-500">Solo propiedades aprobadas y habilitadas.</p>
        {data.propertiesByZone.length ? <ZoneBars items={data.propertiesByZone} /> : <p className="mt-4 text-sm text-slate-500">No hay datos disponibles.</p>}
      </article>

      <article className="rounded-2xl bg-white p-5 shadow-sm">
        <h4 className="text-lg font-black text-navy">Precio promedio por zona</h4>
        <p className="mt-1 text-sm text-slate-500">Canon mensual de las mismas propiedades incluidas en el conteo.</p>
        <div className="mt-4 space-y-3">
          {data.averageRentByZone.length ? data.averageRentByZone.map((item) => <div key={item.zone} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"><span className="font-bold text-navy">{item.zone}</span><span className="font-black text-blue">{currency.format(item.averageRent)}</span></div>) : <p className="text-sm text-slate-500">No hay datos disponibles.</p>}
        </div>
      </article>

      <article className="rounded-2xl bg-white p-5 shadow-sm">
        <h4 className="text-lg font-black text-navy">Incidencias por estado</h4>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Pendientes", data.incidentsByStatus.PENDIENTE, "bg-amber-50 text-amber-800"],
            ["En proceso", data.incidentsByStatus.EN_PROCESO, "bg-sky/10 text-blue"],
            ["Resueltas", data.incidentsByStatus.RESUELTO, "bg-emerald-50 text-emerald-700"],
          ].map(([label, value, color]) => <div key={String(label)} className={`rounded-xl p-4 ${String(color)}`}><p className="text-sm font-bold">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}
        </div>
      </article>

      <article className="rounded-2xl bg-white p-5 shadow-sm">
        <h4 className="text-lg font-black text-navy">Top 5 Arrendadores</h4>
        <p className="mt-1 text-sm text-slate-500">Por propiedades registradas, incluyendo registros históricos.</p>
        <div className="mt-4 space-y-2">
          {data.topLandlords.length ? data.topLandlords.map((landlord, index) => <div key={landlord.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-sm font-black text-white">#{index + 1}</span><span className="truncate font-bold text-navy">{landlord.fullName}</span></div><div className="flex shrink-0 items-center gap-2"><span className="text-sm font-black text-blue">{landlord.propertiesCount} prop.</span><span className={`rounded-full px-2 py-1 text-xs font-bold ${landlord.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{landlord.active ? "Activo" : "Inhabilitado"}</span></div></div>) : <p className="text-sm text-slate-500">No hay arrendadores registrados.</p>}
        </div>
      </article>
    </div> : null}
  </section>;
}
