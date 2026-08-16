import { PersonalDashboardSummary } from "@/components/personal-dashboard-summary";
import { RentalWorkspace } from "@/components/rental-workspace";
import { SectionHeader } from "@/components/ui";

export default function ArrendatarioPanelPage() {
  return <section className="space-y-8"><SectionHeader eyebrow="Espacio del arrendatario" title="Tu resumen de vivienda" description="Revisa lo importante y usa los módulos para explorar, gestionar solicitudes, contratos e incidencias." /><PersonalDashboardSummary /><RentalWorkspace role="ARRENDATARIO" module="summary" /></section>;
}
