import { createStorageSignedUrl, IDENTITY_DOCUMENTS_BUCKET } from "@/lib/supabase/storage";
import type { ReviewIdentityDocument } from "@/repositories/identity.repository";

export function serializeReviewIdentityDocument(document: ReviewIdentityDocument) {
  return createStorageSignedUrl(IDENTITY_DOCUMENTS_BUCKET, document.storagePath, 300).then((downloadUrl) => ({ id: document.id, user: document.user, uploadedBy: document.uploadedBy, documentType: document.documentType, side: document.side, originalName: document.originalName, mimeType: document.mimeType, fileSize: Number(document.fileSize), verificationStatus: document.verificationStatus, uploadedAt: document.uploadedAt.toISOString(), reviewedAt: document.reviewedAt?.toISOString() ?? null, reviewNotes: document.reviewNotes, expiresAt: document.expiresAt?.toISOString() ?? null, isCurrent: document.isCurrent, downloadUrl }));
}
