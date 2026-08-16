import { PersonalDashboardSummary } from "@/components/personal-dashboard-summary";
import { RentalCatalog } from "@/components/rental-catalog";
import { RentalWorkspace } from "@/components/rental-workspace";
import { SectionHeader } from "@/components/ui";

export default function ArrendatarioPanelPage() {
  return <section className="space-y-10">
    <SectionHeader eyebrow="Espacio del arrendatario" title="Encuentra un hogar que te quede cerca" description="Explora inmuebles disponibles en Manta, compara sus servicios y ubica cada opción en el mapa antes de contactar al arrendador." />
    <PersonalDashboardSummary />
    <RentalCatalog />
    <RentalWorkspace role="ARRENDATARIO" />
  </section>;
}
