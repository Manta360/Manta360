import { NextResponse } from "next/server";
import { IdentityDocumentType, Prisma } from "@prisma/client";
import { z } from "zod";
import { getActiveSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { UploadValidationError, validateUpload } from "@/lib/file-validation";
import {
  IDENTITY_DOCUMENTS_BUCKET,
  createStorageSignedUrl,
  identityDocumentPath,
  uploadStorageFile,
} from "@/lib/supabase/storage";

const documentTypeSchema = z.enum(["CEDULA", "PASAPORTE"]);

function canManageIdentityDocuments(role: string): boolean {
  return role === "ARRENDADOR" || role === "ARRENDATARIO";
}

function documentResponse(document: {
  id: string;
  documentType: IdentityDocumentType;
  side: string;
  originalName: string;
  extension: string;
  mimeType: string;
  fileSize: bigint;
  sha256: string;
  verificationStatus: string;
  uploadedAt: Date;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  expiresAt: Date | null;
  isCurrent: boolean;
  storagePath: string;
}) {
  return createStorageSignedUrl(IDENTITY_DOCUMENTS_BUCKET, document.storagePath, 300).then((downloadUrl) => ({
    id: document.id,
    documentType: document.documentType,
    side: document.side,
    originalName: document.originalName,
    extension: document.extension,
    mimeType: document.mimeType,
    fileSize: Number(document.fileSize),
    sha256: document.sha256,
    verificationStatus: document.verificationStatus,
    uploadedAt: document.uploadedAt.toISOString(),
    reviewedAt: document.reviewedAt?.toISOString() ?? null,
    reviewNotes: document.reviewNotes,
    expiresAt: document.expiresAt?.toISOString() ?? null,
    isCurrent: document.isCurrent,
    downloadUrl,
  }));
}

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!canManageIdentityDocuments(session.role)) return NextResponse.json({ error: "Este panel no puede consultar documentos de identidad" }, { status: 403 });

  try {
    const documents = await prisma.identity_documents.findMany({ where: { userId: session.sub }, orderBy: [{ isCurrent: "desc" }, { uploadedAt: "desc" }] });
    return NextResponse.json({ documents: await Promise.all(documents.map(documentResponse)) });
  } catch (error) {
    console.error("identity documents list error", error);
    return NextResponse.json({ error: "No se pudieron cargar los documentos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!canManageIdentityDocuments(session.role)) return NextResponse.json({ error: "Este panel no puede cargar documentos de identidad" }, { status: 403 });

  let formData: FormData;
  try { formData = await request.formData(); } catch { return NextResponse.json({ error: "Formulario multipart inválido" }, { status: 400 }); }
  const typeValue = formData.get("documentType");
  const parsedType = documentTypeSchema.safeParse(typeof typeValue === "string" ? typeValue : "");
  if (!parsedType.success) return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
  const sideValue = formData.get("side");
  const side = parsedType.data === "CEDULA" ? (sideValue === "FRENTE" || sideValue === "REVERSO" ? sideValue : null) : "UNICA";
  if (!side) return NextResponse.json({ error: "Indica si corresponde al frente o reverso de la cedula" }, { status: 400 });
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Debes seleccionar un documento" }, { status: 400 });

  let expiresAt: Date | null = null;
  const expiresAtValue = formData.get("expiresAt");
  if (typeof expiresAtValue === "string" && expiresAtValue.trim()) {
    const parsedDate = new Date(expiresAtValue);
    if (Number.isNaN(parsedDate.getTime())) return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });
    expiresAt = parsedDate;
  }

  let storagePath = "";
  try {
    const upload = await validateUpload(file, "identity-document");
    const duplicate = await prisma.identity_documents.findFirst({
      where: { userId: session.sub, documentType: parsedType.data, side, sha256: upload.sha256, isCurrent: true },
    });
    if (duplicate) return NextResponse.json({ document: await documentResponse(duplicate), alreadyUploaded: true });

    storagePath = identityDocumentPath(session.sub, upload.extension);
    await uploadStorageFile(IDENTITY_DOCUMENTS_BUCKET, storagePath, upload);
    const document = await prisma.$transaction(async (tx) => {
      await tx.identity_documents.updateMany({ where: { userId: session.sub, documentType: parsedType.data, side, isCurrent: true }, data: { isCurrent: false } });
      return tx.identity_documents.create({
        data: {
          userId: session.sub,
          uploadedBy: session.sub,
          documentType: parsedType.data,
          side,
          storagePath,
          originalName: upload.originalName,
          extension: upload.extension,
          mimeType: upload.mimeType,
          fileSize: BigInt(upload.fileSize),
          sha256: upload.sha256,
          verificationStatus: "PENDIENTE",
          expiresAt,
          isCurrent: true,
        },
      });
    });
    return NextResponse.json({ document: await documentResponse(document) }, { status: 201 });
  } catch (error) {
    if (storagePath) {
      const { removeStorageFile } = await import("@/lib/supabase/storage");
      await removeStorageFile(IDENTITY_DOCUMENTS_BUCKET, storagePath).catch((cleanupError) => console.error("identity document cleanup error", cleanupError));
    }
    if (error instanceof UploadValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Ese documento ya existe" }, { status: 409 });
    console.error("identity document create error", error);
    return NextResponse.json({ error: "No se pudo cargar el documento" }, { status: 500 });
  }
}
