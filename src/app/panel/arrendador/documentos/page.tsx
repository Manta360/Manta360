import { IdentityDocumentUploadForm } from "@/components/identity-document-upload-form";
import { SectionHeader } from "@/components/ui";
export default function LandlordDocumentsPage() { return <section className="space-y-8"><SectionHeader eyebrow="Documentos" title="Tu identidad" description="Consulta el estado de tu verificación municipal." /><IdentityDocumentUploadForm /></section>; }
