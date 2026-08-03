import { RentalCatalog } from "@/components/rental-catalog";

export default function ArrendatarioPanelPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-[.18em] text-sky">Espacio del arrendatario</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-navy">Propiedades para alquilar</h2>
        <p className="mt-3 max-w-2xl text-slate-600">Explora inmuebles disponibles en los sectores más buscados de Manta y ubica cada opción en el mapa.</p>
      </div>
      <RentalCatalog />
    </section>
  );
}
