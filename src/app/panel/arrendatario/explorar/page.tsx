import { RentalCatalog } from "@/components/rental-catalog";
import { SectionHeader } from "@/components/ui";
export default function TenantExplorePage() { return <section className="space-y-8"><SectionHeader eyebrow="Explorar" title="Propiedades disponibles" description="Usa los filtros y el mapa para encontrar una opción adecuada." /><RentalCatalog /></section>; }
