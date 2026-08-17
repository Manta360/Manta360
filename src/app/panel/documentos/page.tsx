import { IdentityDocumentUploadForm } from "@/components/identity-document-upload-form";
import { IdentityDocumentReviewPanel } from "@/components/identity-document-review-panel";
import { SectionHeader } from "@/components/ui";
import { getActiveSession } from "@/lib/server-auth";

export default async function DocumentsPanelPage() {
  const session = await getActiveSession();
  const municipality = session?.role === "MUNICIPIO";

  return <section className="space-y-8">
    <SectionHeader
      eyebrow="Documentos de identidad"
      title={municipality ? "Validar documentos" : "Mis documentos"}
      description={municipality ? "Aprueba o rechaza las identificaciones pendientes para habilitar al usuario." : "Carga tu cédula completa o pasaporte. Los archivos anteriores se conservan como historial."}
    />
    {municipality ? <IdentityDocumentReviewPanel /> : <IdentityDocumentUploadForm />}
  </section>;
}
