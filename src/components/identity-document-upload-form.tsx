"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, EmptyState, LoadingState, StatusBadge } from "@/components/ui";

type IdentityDocument = { id: string; documentType: "CEDULA" | "PASAPORTE"; side: string; originalName: string; verificationStatus: string; uploadedAt: string; isCurrent: boolean; downloadUrl: string | null };

export function IdentityDocumentUploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [documents, setDocuments] = useState<IdentityDocument[]>([]);
  const [documentType, setDocumentType] = useState<"CEDULA" | "PASAPORTE">("CEDULA");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const loadDocuments = async () => {
    try {
      const response = await fetch("/api/identity-documents");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar tus documentos");
      setDocuments(data.documents);
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudieron cargar tus documentos" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadDocuments(); }, []);

  const uploadOne = async (file: File, side: string, expiresAt: string) => {
    const data = new FormData();
    data.append("documentType", documentType); data.append("side", side); data.append("file", file);
    if (expiresAt) data.append("expiresAt", expiresAt);
    const response = await fetch("/api/identity-documents", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "No se pudo cargar el documento");
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null);
    const form = new FormData(event.currentTarget); const expiresAt = String(form.get("expiresAt") ?? "");
    const front = form.get("front"); const back = form.get("back"); const passport = form.get("passport");
    if (documentType === "CEDULA" && (!(front instanceof File) || front.size === 0 || !(back instanceof File) || back.size === 0)) { setMessage({ type: "error", text: "Debes seleccionar las dos fotos: frente y reverso de la cédula." }); return; }
    if (documentType === "PASAPORTE" && (!(passport instanceof File) || passport.size === 0)) { setMessage({ type: "error", text: "Selecciona la foto o PDF del pasaporte." }); return; }
    setSubmitting(true);
    try {
      if (documentType === "CEDULA") { await uploadOne(front as File, "FRENTE", expiresAt); await uploadOne(back as File, "REVERSO", expiresAt); }
      else await uploadOne(passport as File, "UNICA", expiresAt);
      setMessage({ type: "success", text: "Documento enviado correctamente a revisión municipal." }); formRef.current?.reset();
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudo cargar el documento" }); }
    finally { await loadDocuments(); setSubmitting(false); }
  }

  return <section className="app-panel p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-violet">Identidad segura</p><h2 className="mt-2 text-2xl font-black text-navy">Verifica tu documento</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Carga tu cédula por ambos lados o tu pasaporte. El Municipio revisará los archivos antes de habilitar publicaciones y solicitudes.</p></div><span className="rounded-full bg-violet/10 px-3 py-2 text-xs font-black text-violet">1. Cargar · 2. Revisar · 3. Verificar</span></div><form ref={formRef} onSubmit={handleSubmit} className="mt-7 space-y-6"><fieldset><legend className="text-sm font-extrabold text-navy">Tipo de documento</legend><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => setDocumentType("CEDULA")} aria-pressed={documentType === "CEDULA"} className={`rounded-xl px-5 py-3 font-bold transition ${documentType === "CEDULA" ? "bg-blue text-white shadow-sm" : "bg-surface-subtle text-muted hover:bg-sky/10"}`}>Cédula (2 lados)</button><button type="button" onClick={() => setDocumentType("PASAPORTE")} aria-pressed={documentType === "PASAPORTE"} className={`rounded-xl px-5 py-3 font-bold transition ${documentType === "PASAPORTE" ? "bg-blue text-white shadow-sm" : "bg-surface-subtle text-muted hover:bg-sky/10"}`}>Pasaporte</button></div></fieldset>{documentType === "CEDULA" ? <div className="grid gap-5 md:grid-cols-2"><UploadCard name="front" title="Frente de la cédula" number="1" hint="Foto clara del lado con tus datos y fotografía." /><UploadCard name="back" title="Reverso de la cédula" number="2" hint="Foto clara del lado posterior del documento." /></div> : <UploadCard name="passport" title="Pasaporte" number="1" hint="Carga la página donde aparecen tus datos personales." />}<label className="block max-w-xs"><span className="text-sm font-extrabold text-navy">Vencimiento físico <span className="font-medium text-muted-foreground">(opcional)</span></span><input name="expiresAt" type="date" className="field-input mt-2" /></label><Button type="submit" loading={submitting} variant="primary">{documentType === "CEDULA" ? "Enviar frente y reverso" : "Enviar pasaporte"}</Button></form>{message ? <Alert tone={message.type === "error" ? "danger" : "success"} className="mt-5" title={message.type === "error" ? "No se pudo completar la carga" : "Carga enviada"}>{message.text}</Alert> : null}<div className="mt-8 border-t border-border pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-black uppercase tracking-wide text-navy">Historial de documentos</h3><span className="text-xs font-medium text-muted-foreground">Los archivos se entregan con acceso seguro</span></div>{loading ? <LoadingState className="mt-4" title="Cargando historial" /> : documents.length === 0 ? <EmptyState className="mt-4" title="Aún no has cargado documentos" description="Selecciona el tipo de documento y carga los archivos para iniciar la revisión." /> : <div className="mt-4 space-y-3">{documents.map((document) => <article key={document.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${document.isCurrent ? "border-sky/50 bg-sky/[.04]" : "border-border bg-surface"}`}><div><p className="font-bold text-navy">{document.documentType === "CEDULA" ? `Cédula · ${document.side === "FRENTE" ? "frente" : "reverso"}` : "Pasaporte"}</p><p className="mt-1 text-xs text-muted-foreground">{document.originalName} · {new Date(document.uploadedAt).toLocaleDateString("es-EC")}</p></div><div className="flex items-center gap-3"><StatusBadge status={document.verificationStatus} />{document.downloadUrl ? <a href={document.downloadUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue hover:underline">Ver archivo</a> : null}</div></article>)}</div>}</div></section>;
}

function UploadCard({ name, title, number, hint }: { name: string; title: string; number: string; hint: string }) {
  return <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-violet/40 bg-violet/[.03] p-6 transition hover:border-violet hover:bg-violet/[.08]"><span className="grid h-8 w-8 place-items-center rounded-full bg-violet text-sm font-black text-white">{number}</span><span className="mt-4 block font-black text-navy">{title}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{hint}</span><input required name={name} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="mt-5 block w-full text-sm text-navy" /></label>;
}
