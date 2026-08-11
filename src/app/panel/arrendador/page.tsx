import { PropertyPublishForm } from "@/components/property-publish-form";
import { RentalWorkspace } from "@/components/rental-workspace";
import { IdentityValidationBadge } from "@/components/identity-validation-badge";
import { PersonalDashboardSummary } from "@/components/personal-dashboard-summary";

export default function ArrendadorPanelPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-[.18em] text-sky">Panel del arrendador</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-navy">Publica tu propiedad</h2>
        <p className="mt-3 max-w-2xl text-slate-600">Comparte los detalles de tu inmueble y conecta con personas que buscan un hogar en Manta.</p>
      </div>
      <IdentityValidationBadge />
      <PersonalDashboardSummary />
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black text-amber-800">PASO 1</p><p className="mt-1 font-bold text-navy">Verifica tu identidad</p><p className="mt-1 text-sm text-slate-600">Sube cédula o pasaporte.</p></div><div className="rounded-xl border border-sky/30 bg-sky/5 p-4"><p className="text-xs font-black text-blue">PASO 2</p><p className="mt-1 font-bold text-navy">Completa la propiedad</p><p className="mt-1 text-sm text-slate-600">Incluye 3 fotos y ubicación.</p></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black text-emerald-700">PASO 3</p><p className="mt-1 font-bold text-navy">Espera la aprobación</p><p className="mt-1 text-sm text-slate-600">El Municipio la hará pública.</p></div></div>
      <PropertyPublishForm />
      <RentalWorkspace role="ARRENDADOR" />
    </section>
  );
}
