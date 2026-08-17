import { LandlordPropertiesPanel } from "@/components/landlord-properties-panel";
import { PropertyPublishForm } from "@/components/property-publish-form";
import { SectionHeader } from "@/components/ui";
export default function LandlordPropertiesPage() { return <section className="space-y-8"><SectionHeader eyebrow="Propiedades" title="Gestiona tus inmuebles" description="Publica nuevas propiedades y administra sus datos, imágenes y disponibilidad." /><PropertyPublishForm /><LandlordPropertiesPanel /></section>; }
