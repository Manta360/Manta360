import { IdentityDocumentUploadForm } from "@/components/identity-document-upload-form";
import { IdentityDocumentReviewPanel } from "@/components/identity-document-review-panel";
import { getActiveSession } from "@/lib/server-auth";

export default async function DocumentsPanelPage() {
  const session = await getActiveSession();
  const municipality = session?.role === "MUNICIPIO";
  return <section className="space-y-8"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-violet">Documentos de identidad</p><h2 className="mt-2 text-3xl font-black tracking-tight text-navy">{municipality ? "Validar documentos" : "Mis documentos"}</h2><p className="mt-3 max-w-2xl text-slate-600">{municipality ? "Aprueba o rechaza las identificaciones pendientes para habilitar al usuario." : "Carga tu cedula completa o pasaporte. Los archivos anteriores se conservan como historial."}</p></div>{municipality ? <IdentityDocumentReviewPanel /> : <IdentityDocumentUploadForm />}</section>;
}
