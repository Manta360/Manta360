import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/lib/file-validation", () => ({
  UploadValidationError: class UploadValidationError extends Error {},
  validateUpload: vi.fn(),
}));
vi.mock("@/lib/supabase/storage", () => ({
  IDENTITY_DOCUMENTS_BUCKET: "identity-documents",
  createStorageSignedUrl: vi.fn().mockResolvedValue("https://signed/document"),
  identityDocumentPath: vi.fn().mockReturnValue("identity-documents/user-1/document.jpg"),
  uploadStorageFile: vi.fn(),
  removeStorageFile: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    identity_documents: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/repositories/identity.server", () => ({ identityRepository: { listDocumentsForUser: vi.fn() } }));
vi.mock("@/lib/identity-document-pg", () => ({ serializeIdentityDocument: vi.fn(async (item) => ({ ...item, fileSize: Number(item.fileSize), downloadUrl: "https://signed/document" })) }));

import { getActiveSession } from "@/lib/server-auth";
import { validateUpload } from "@/lib/file-validation";
import { prisma } from "@/lib/prisma";
import { uploadStorageFile } from "@/lib/supabase/storage";
import { identityRepository } from "@/repositories/identity.server";
import { GET, POST } from "@/app/api/identity-documents/route";

const session = vi.mocked(getActiveSession);
const db = prisma as unknown as {
  identity_documents: Record<string, ReturnType<typeof vi.fn>>;
  $transaction: ReturnType<typeof vi.fn>;
};
const landlord = { sub: "user-1", email: "owner@test.com", role: "ARRENDADOR" as const, fullName: "Dueño" };
const document = {
  id: "doc-1", documentType: "CEDULA", side: "FRENTE", originalName: "frente.jpg", extension: "jpg", mimeType: "image/jpeg",
  fileSize: BigInt(12), sha256: "a".repeat(64), verificationStatus: "PENDIENTE", uploadedAt: new Date(), reviewedAt: null,
  reviewNotes: null, expiresAt: null, isCurrent: true, storagePath: "identity-documents/user-1/document.jpg",
};

function uploadRequest(side: "FRENTE" | "REVERSO") {
  const form = new FormData();
  form.append("documentType", "CEDULA"); form.append("side", side);
  form.append("file", new Blob(["document"], { type: "image/jpeg" }), `${side}.jpg`);
  return new Request("http://localhost/api/identity-documents", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue(landlord);
  db.identity_documents.findFirst.mockResolvedValue(null);
  db.identity_documents.updateMany.mockResolvedValue({ count: 0 });
  db.identity_documents.create.mockResolvedValue(document);
  vi.mocked(identityRepository.listDocumentsForUser).mockResolvedValue([document] as never);
  db.$transaction.mockImplementation(async (operation: (tx: unknown) => Promise<unknown>) => operation({ identity_documents: db.identity_documents }));
  vi.mocked(validateUpload).mockResolvedValue({ buffer: Buffer.from("document"), extension: "jpg", mimeType: "image/jpeg", fileSize: 12, sha256: "a".repeat(64), originalName: "frente.jpg" });
});

describe("identidad - documentos por lado", () => {
  it("lista historial propio para un arrendador", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(identityRepository.listDocumentsForUser).toHaveBeenCalledWith(landlord.sub);
    await expect(response.json()).resolves.toMatchObject({ documents: [{ id: document.id, sha256: document.sha256 }] });
  });

  it("requiere sesión y bloquea al municipio al listar", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    session.mockResolvedValue({ ...landlord, role: "MUNICIPIO" });
    expect((await GET()).status).toBe(403);
  });

  it("permite listar al arrendatario sin ampliar ownership", async () => {
    session.mockResolvedValue({ ...landlord, role: "ARRENDATARIO", sub: "tenant-1" });
    await GET();
    expect(identityRepository.listDocumentsForUser).toHaveBeenCalledWith("tenant-1");
  });

  it("devuelve un error genérico sin detalles PostgreSQL", async () => {
    vi.mocked(identityRepository.listDocumentsForUser).mockRejectedValue(new Error("SELECT * FROM identity_documents at internal-host"));
    const response = await GET();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "No se pudieron cargar los documentos" });
  });

  it("acepta frente y reverso como documentos distintos", async () => {
    const first = await POST(uploadRequest("FRENTE"));
    const second = await POST(uploadRequest("REVERSO"));
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(db.identity_documents.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ side: "FRENTE", isCurrent: true }) }));
    expect(db.identity_documents.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ side: "REVERSO", isCurrent: true }) }));
  });

  it("trata la misma carga activa como idempotente", async () => {
    db.identity_documents.findFirst.mockResolvedValue(document);
    const response = await POST(uploadRequest("FRENTE"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ alreadyUploaded: true, document: { id: document.id } });
    expect(uploadStorageFile).not.toHaveBeenCalled();
    expect(db.identity_documents.create).not.toHaveBeenCalled();
  });

  it("mantiene historial solo para el mismo tipo y lado", async () => {
    await POST(uploadRequest("REVERSO"));
    expect(db.identity_documents.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: landlord.sub, documentType: "CEDULA", side: "REVERSO", isCurrent: true },
    }));
  });
});
