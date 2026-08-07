import { IdentityDocumentUploadForm } from "@/components/identity-document-upload-form";

export default function DocumentsPanelPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-[.18em] text-violet">Documentos de identidad</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-navy">Mis documentos</h2>
        <p className="mt-3 max-w-2xl text-slate-600">Carga tu cédula o pasaporte desde esta pestaña. Los archivos anteriores se conservan como historial.</p>
      </div>
      <IdentityDocumentUploadForm />
    </section>
  );
}
