"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type IdentityDocument = {
  id: string;
  documentType: "CEDULA" | "PASAPORTE";
  originalName: string;
  verificationStatus: string;
  uploadedAt: string;
  expiresAt: string | null;
  isCurrent: boolean;
  downloadUrl: string | null;
};

const statusLabels: Record<string, string> = { PENDIENTE: "Pendiente", EN_REVISION: "En revisión", VERIFICADO: "Verificado", RECHAZADO: "Rechazado" };

export function IdentityDocumentUploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [documents, setDocuments] = useState<IdentityDocument[]>([]);
  const [documentType, setDocumentType] = useState<"CEDULA" | "PASAPORTE">("CEDULA");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function loadDocuments() {
    try {
      const response = await fetch("/api/identity-documents");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar tus documentos");
      setDocuments(data.documents);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudieron cargar tus documentos" });
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadDocuments(); }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null);
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) { setMessage({ type: "error", text: "Selecciona un archivo" }); return; }
    form.set("documentType", documentType);
    setSubmitting(true);
    try {
      const response = await fetch("/api/identity-documents", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo cargar el documento");
      setMessage({ type: "success", text: "Documento cargado correctamente y enviado a revisión." });
      formRef.current?.reset();
      await loadDocuments();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudo cargar el documento" });
    } finally { setSubmitting(false); }
  }

  return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-violet">Identidad</p><h2 className="mt-2 text-2xl font-black text-navy">Carga tu documento</h2><p className="mt-2 text-sm text-slate-500">El archivo se guarda en un bucket privado y solo se muestra mediante un enlace temporal.</p></div><form ref={formRef} onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-[180px_1fr_180px_auto] md:items-end"><label className="space-y-2"><span className="text-sm font-bold text-navy">Tipo</span><select name="documentType" value={documentType} onChange={(event) => setDocumentType(event.target.value as "CEDULA" | "PASAPORTE")} className="field-input"><option value="CEDULA">Cédula</option><option value="PASAPORTE">Pasaporte</option></select></label><label className="space-y-2"><span className="text-sm font-bold text-navy">Archivo</span><input required name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="space-y-2"><span className="text-sm font-bold text-navy">Vencimiento físico</span><input name="expiresAt" type="date" className="field-input" /></label><button type="submit" disabled={submitting} className="rounded-xl bg-violet px-5 py-3 font-bold text-white transition hover:opacity-90 disabled:opacity-60">{submitting ? "Cargando..." : "Cargar documento"}</button></form>{message ? <p role={message.type === "error" ? "alert" : "status"} className={`mt-4 rounded-lg px-4 py-3 text-sm font-semibold ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{message.text}</p> : null}<div className="mt-7 space-y-3"><h3 className="text-sm font-black uppercase tracking-wide text-navy">Historial de documentos</h3>{loading ? <p className="text-sm text-slate-500">Cargando...</p> : documents.length === 0 ? <p className="text-sm text-slate-500">Aún no has cargado documentos.</p> : documents.map((document) => <div key={document.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${document.isCurrent ? "border-sky/50 bg-sky/5" : "border-slate-200"}`}><div><p className="font-semibold text-navy">{document.documentType === "CEDULA" ? "Cédula" : "Pasaporte"} · {document.originalName}</p><p className="text-xs text-slate-500">{new Date(document.uploadedAt).toLocaleDateString("es-EC")} · {document.isCurrent ? "Versión actual" : "Versión anterior"}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{statusLabels[document.verificationStatus] ?? document.verificationStatus}</span>{document.downloadUrl ? <a href={document.downloadUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue hover:underline">Ver</a> : null}</div></div>)}</div></section>;
}
