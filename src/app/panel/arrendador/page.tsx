import { PropertyPublishForm } from "@/components/property-publish-form";

export default function ArrendadorPanelPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-[.18em] text-sky">Panel del arrendador</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-navy">Publica tu propiedad</h2>
        <p className="mt-3 max-w-2xl text-slate-600">Comparte los detalles de tu inmueble y conecta con personas que buscan un hogar en Manta.</p>
      </div>
      <PropertyPublishForm />
    </section>
  );
}
