import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/server-auth";
import { serializeReviewIdentityDocument } from "@/lib/identity-review-pg";
import { identityRepository, runIdentityTransaction } from "@/repositories/identity.server";
import { type IdentityDocumentStatus } from "@/repositories/identity.repository";

const reviewSchema = z.object({
  documentId: z.string().uuid(),
  status: z.enum(["PENDIENTE", "EN_REVISION", "VERIFICADO", "RECHAZADO"]),
  notes: z.string().trim().max(2000).optional().nullable(),
});

async function reviewerSession() {
  const session = await getActiveSession();
  if (!session) return { session: null, response: NextResponse.json({ error: "Sesión requerida" }, { status: 401 }) };
  if (session.role !== "MUNICIPIO") return { session: null, response: NextResponse.json({ error: "No tienes permiso para revisar documentos" }, { status: 403 }) };
  return { session, response: null };
}

export async function GET(request: Request) {
  const auth = await reviewerSession();
  if (!auth.session) return auth.response;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const validStatus: IdentityDocumentStatus | null = status === "PENDIENTE" || status === "EN_REVISION" || status === "VERIFICADO" || status === "RECHAZADO" ? status : null;

  try {
    const documents = await identityRepository.listReviewDocuments(validStatus);
    return NextResponse.json({ documents: await Promise.all(documents.map(serializeReviewIdentityDocument)) });
  } catch (error) {
    console.error("review documents list error", error);
    return NextResponse.json({ error: "No se pudieron cargar los documentos para revisión" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await reviewerSession();
  if (!auth.session) return auth.response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos de revisión inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
    const document = await runIdentityTransaction((repository) => repository.reviewDocument(parsed.data.documentId, auth.session.sub, parsed.data.status, parsed.data.notes ?? null));
    if (!document) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    return NextResponse.json({ document: { id: document.id, verificationStatus: document.verificationStatus, reviewedAt: document.reviewedAt?.toISOString() ?? null, reviewNotes: document.reviewNotes } });
  } catch (error) {
    console.error("review document update error", error);
    return NextResponse.json({ error: "No se pudo actualizar la revisión" }, { status: 500 });
  }
}
