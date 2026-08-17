import { IdentityDocumentUploadForm } from "@/components/identity-document-upload-form";
import { SectionHeader } from "@/components/ui";
export default function TenantDocumentsPage() { return <section className="space-y-8"><SectionHeader eyebrow="Documentos" title="Tu identidad" description="Carga y consulta tus documentos con acceso seguro." /><IdentityDocumentUploadForm /></section>; }
