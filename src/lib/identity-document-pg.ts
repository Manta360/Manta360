import { createStorageSignedUrl, IDENTITY_DOCUMENTS_BUCKET } from "@/lib/supabase/storage";
import type { IdentityDocument } from "@/repositories/identity.repository";

export function serializeIdentityDocument(document: IdentityDocument) {
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
