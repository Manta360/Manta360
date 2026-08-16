import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/storage", () => ({ IDENTITY_DOCUMENTS_BUCKET: "identity-documents", createStorageSignedUrl: vi.fn(async (_bucket, path, ttl) => `https://signed/${ttl}/${path}`) }));

import { serializeIdentityDocument } from "@/lib/identity-document-pg";

describe("serializeIdentityDocument", () => {
  it("mantiene el contrato, ISO/nulls y no expone campos internos nuevos", async () => {
    const result = await serializeIdentityDocument({
      id: "document-1", documentType: "CEDULA", side: "FRENTE", originalName: "front.jpg", extension: "jpg", mimeType: "image/jpeg", fileSize: "12", sha256: "a".repeat(64), verificationStatus: "VERIFICADO", uploadedAt: new Date("2026-01-01T00:00:00.000Z"), reviewedAt: new Date("2026-01-02T00:00:00.000Z"), reviewNotes: null, expiresAt: null, isCurrent: true, storagePath: "identity-documents/user-1/front.jpg", passwordHash: "never-public", reviewedBy: "municipio-1",
    } as never);

    expect(result).toMatchObject({ fileSize: 12, reviewedAt: "2026-01-02T00:00:00.000Z", expiresAt: null, downloadUrl: "https://signed/300/identity-documents/user-1/front.jpg" });
    expect(JSON.stringify(result)).not.toContain("passwordHash");
    expect(JSON.stringify(result)).not.toContain("reviewedBy");
    expect(JSON.stringify(result)).not.toContain("storagePath");
  });
});
