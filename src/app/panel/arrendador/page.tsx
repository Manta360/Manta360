import { IdentityValidationBadge } from "@/components/identity-validation-badge";
import { PersonalDashboardSummary } from "@/components/personal-dashboard-summary";
import { RentalWorkspace } from "@/components/rental-workspace";
import { SectionHeader } from "@/components/ui";

export default function ArrendadorPanelPage() {
  return <section className="space-y-8"><SectionHeader eyebrow="Panel del arrendador" title="Tu resumen de gestión" description="Consulta lo prioritario y entra a cada módulo para administrar propiedades, contratos y solicitudes." /><IdentityValidationBadge /><PersonalDashboardSummary /><RentalWorkspace role="ARRENDADOR" module="summary" /></section>;
}
