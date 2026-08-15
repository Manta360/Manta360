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

import { getActiveSession } from "@/lib/server-auth";
import { validateUpload } from "@/lib/file-validation";
import { prisma } from "@/lib/prisma";
import { uploadStorageFile } from "@/lib/supabase/storage";
import { POST } from "@/app/api/identity-documents/route";

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
  db.$transaction.mockImplementation(async (operation: (tx: unknown) => Promise<unknown>) => operation({ identity_documents: db.identity_documents }));
  vi.mocked(validateUpload).mockResolvedValue({ buffer: Buffer.from("document"), extension: "jpg", mimeType: "image/jpeg", fileSize: 12, sha256: "a".repeat(64), originalName: "frente.jpg" });
});

describe("identidad - documentos por lado", () => {
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
