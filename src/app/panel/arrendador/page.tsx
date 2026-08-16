import { IdentityValidationBadge } from "@/components/identity-validation-badge";
import { LandlordPropertiesPanel } from "@/components/landlord-properties-panel";
import { PersonalDashboardSummary } from "@/components/personal-dashboard-summary";
import { PropertyPublishForm } from "@/components/property-publish-form";
import { RentalWorkspace } from "@/components/rental-workspace";
import { SectionHeader } from "@/components/ui";

const steps = [
  ["PASO 1", "Verifica tu identidad", "Sube cédula o pasaporte.", "border-amber-200 bg-amber-50 text-amber-800"],
  ["PASO 2", "Completa la propiedad", "Incluye fotos, ubicación y servicios.", "border-sky/30 bg-sky/5 text-blue"],
  ["PASO 3", "Espera la aprobación", "El Municipio la hará pública.", "border-emerald-200 bg-emerald-50 text-emerald-700"],
] as const;

export default function ArrendadorPanelPage() {
  return <section className="space-y-10">
    <SectionHeader eyebrow="Panel del arrendador" title="Gestiona tus propiedades con claridad" description="Publica, revisa solicitudes y acompaña el ciclo de cada contrato desde un solo lugar." />
    <IdentityValidationBadge />
    <PersonalDashboardSummary />
    <div className="grid gap-4 sm:grid-cols-3">{steps.map(([step, title, detail, style]) => <article key={step} className={`app-card p-5 ${style}`}><p className="text-xs font-black tracking-[.14em]">{step}</p><p className="mt-2 font-black text-navy">{title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p></article>)}</div>
    <PropertyPublishForm />
    <LandlordPropertiesPanel />
    <RentalWorkspace role="ARRENDADOR" />
  </section>;
}
