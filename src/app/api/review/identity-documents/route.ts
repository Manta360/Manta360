import { NextResponse } from "next/server";
import { IdentityDocumentStatus } from "@prisma/client";
import { z } from "zod";
import { getActiveSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { serializeReviewIdentityDocument } from "@/lib/identity-review-pg";
import { identityRepository } from "@/repositories/identity.server";

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
  const status = url.searchParams.get("status") as IdentityDocumentStatus | null;
  const validStatus = status && Object.values(IdentityDocumentStatus).includes(status) ? status : null;

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
    const document = await prisma.$transaction(async (tx) => {
      const current = await tx.identity_documents.findUnique({ where: { id: parsed.data.documentId } });
      if (!current) throw new Error("DOCUMENT_NOT_FOUND");
      await tx.identity_documents.update({ where: { id: current.id }, data: { verificationStatus: parsed.data.status, reviewedAt: new Date(), reviewedBy: auth.session.sub, reviewNotes: parsed.data.notes ?? null } });
      await tx.identity_document_reviews.create({ data: { identityDocumentId: current.id, reviewerId: auth.session.sub, previousStatus: current.verificationStatus, newStatus: parsed.data.status, notes: parsed.data.notes ?? null } });
      return tx.identity_documents.findUniqueOrThrow({ where: { id: current.id } });
    });
    return NextResponse.json({ document: { id: document.id, verificationStatus: document.verificationStatus, reviewedAt: document.reviewedAt?.toISOString() ?? null, reviewNotes: document.reviewNotes } });
  } catch (error) {
    if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    console.error("review document update error", error);
    return NextResponse.json({ error: "No se pudo actualizar la revisión" }, { status: 500 });
  }
}
