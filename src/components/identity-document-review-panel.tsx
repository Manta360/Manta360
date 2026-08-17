"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { notifyNavigationBadgesChanged } from "@/components/layout/navigation-badges";
import { Button, EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/ui";

type Document = { id: string; user: { id: string; fullName: string; email: string }; documentType: "CEDULA" | "PASAPORTE"; side: string; originalName: string; verificationStatus: string; downloadUrl: string | null };
const sideLabel: Record<string, string> = { FRENTE: "Frente de cédula", REVERSO: "Reverso de cédula", UNICA: "Pasaporte" };
const filters = ["PENDIENTE", "VERIFICADO", "RECHAZADO"];

export function IdentityDocumentReviewPanel() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filter, setFilter] = useState("PENDIENTE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/review/identity-documents?status=${filter}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo cargar la bandeja");
      setDocuments(data.documents);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cargar la bandeja"); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const review = async (documentId: string, status: "VERIFICADO" | "RECHAZADO") => {
    setBusy(documentId);
    try {
      const response = await fetch("/api/review/identity-documents", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId, status, notes: notes[documentId] || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo actualizar el documento");
      await load();
      notifyNavigationBadgesChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar el documento"); }
    finally { setBusy(null); }
  };

  const grouped = useMemo(() => Object.values(documents.reduce<Record<string, Document[]>>((all, document) => { (all[document.user.id] ??= []).push(document); return all; }, {})), [documents]);

  return <section className="app-panel p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-violet">Validación municipal</p><h2 className="mt-2 text-2xl font-black text-navy">Bandeja de documentos</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Revisa frente y reverso juntos. Para habilitar una cédula, valida las dos imágenes de la misma persona.</p></div><div className="flex rounded-xl bg-surface-subtle p-1" aria-label="Filtrar documentos">{filters.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${filter === item ? "bg-surface text-blue shadow-sm" : "text-muted hover:text-navy"}`}>{item.charAt(0) + item.slice(1).toLowerCase()}</button>)}</div></div>
    {error ? <ErrorState className="mt-5" title="No se pudo actualizar la bandeja" description={error} action={<Button variant="secondary" onClick={() => void load()}>Reintentar</Button>} /> : null}
    {loading ? <LoadingState className="mt-6" title="Cargando documentos" description="Consultando la bandeja de revisión municipal." /> : null}
    {!loading && !error && grouped.length === 0 ? <EmptyState className="mt-6" title="No hay documentos en esta bandeja" description="Cuando existan documentos con este estado, aparecerán aquí para su revisión." /> : null}
    {!loading && !error && grouped.length > 0 ? <div className="mt-6 space-y-6">{grouped.map((group) => <article key={group[0].user.id} className="rounded-2xl border border-border bg-surface-subtle/40 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-navy">{group[0].user.fullName}</h3><p className="text-sm text-muted-foreground">{group[0].user.email} · {group.length} archivo(s)</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-warning">{group.filter((item) => item.verificationStatus === "VERIFICADO").length}/{group.length} verificados</span></div><div className="mt-5 grid gap-4 md:grid-cols-2">{group.map((document) => <article key={document.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-navy">{sideLabel[document.side] ?? document.documentType}</p><p className="mt-1 text-xs text-muted-foreground">{document.originalName}</p></div><StatusBadge status={document.verificationStatus} /></div>{document.downloadUrl ? <a href={document.downloadUrl} target="_blank" rel="noreferrer" className="mt-4 block rounded-lg border border-border bg-surface-subtle p-3 text-sm font-bold text-blue transition hover:border-sky hover:bg-sky/5">Abrir archivo para revisar</a> : <p className="mt-4 rounded-lg bg-surface-subtle p-3 text-sm text-muted-foreground">El enlace seguro no está disponible.</p>}<label className="mt-4 block"><span className="text-xs font-extrabold uppercase tracking-wide text-navy">Observación para el usuario</span><textarea value={notes[document.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="Agrega una nota opcional" className="field-input mt-2 min-h-24 resize-y" /></label><div className="mt-4 flex flex-wrap gap-2"><Button loading={busy === document.id} disabled={document.verificationStatus === "VERIFICADO"} variant="primary" onClick={() => void review(document.id, "VERIFICADO")}>Aprobar</Button><Button loading={busy === document.id} variant="danger" onClick={() => void review(document.id, "RECHAZADO")}>Rechazar</Button></div></article>)}</div></article>)}</div> : null}
  </section>;
}
