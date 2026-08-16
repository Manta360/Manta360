import type { QueryResultRow } from "pg";

export type IdentityDocument = {
  id: string;
  documentType: string;
  side: string;
  originalName: string;
  extension: string;
  mimeType: string;
  fileSize: string | number;
  sha256: string;
  verificationStatus: string;
  uploadedAt: Date;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  expiresAt: Date | null;
  isCurrent: boolean;
  storagePath: string;
};
export type IdentityDocumentType = "CEDULA" | "PASAPORTE";
export type IdentityDocumentStatus = "PENDIENTE" | "EN_REVISION" | "VERIFICADO" | "RECHAZADO";
export type ReviewIdentityDocument = { id: string; user: { id: string; fullName: string; email: string }; uploadedBy: { id: string; fullName: string; email: string }; documentType: string; side: string; originalName: string; mimeType: string; fileSize: string | number; verificationStatus: string; uploadedAt: Date; reviewedAt: Date | null; reviewNotes: string | null; expiresAt: Date | null; isCurrent: boolean; storagePath: string };

export type IdentitySqlResult<Row> = { rows: Row[] };
export interface IdentitySqlExecutor { query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<IdentitySqlResult<Row>>; }

const LIST_DOCUMENTS_FOR_USER_SQL = `
  SELECT id, "documentType", side, "originalName", extension, "mimeType", "fileSize", sha256,
    "verificationStatus", "uploadedAt", "reviewedAt", "reviewNotes", "expiresAt", "isCurrent", "storagePath"
  FROM public.identity_documents
  WHERE "userId" = $1
  ORDER BY "isCurrent" DESC, "uploadedAt" DESC
`;
const REVIEW_DOCUMENTS_SQL = `
  SELECT d.id, jsonb_build_object('id', u.id, 'fullName', u."fullName", 'email', u.email) AS "user", jsonb_build_object('id', uploader.id, 'fullName', uploader."fullName", 'email', uploader.email) AS "uploadedBy", d."documentType", d.side, d."originalName", d."mimeType", d."fileSize", d."verificationStatus", d."uploadedAt", d."reviewedAt", d."reviewNotes", d."expiresAt", d."isCurrent", d."storagePath"
  FROM public.identity_documents d
  JOIN public.users u ON u.id = d."userId"
  JOIN public.users uploader ON uploader.id = d."uploadedBy"
`;

export class IdentityRepository {
  constructor(private readonly executor: IdentitySqlExecutor) {}

  async listDocumentsForUser(userId: string): Promise<IdentityDocument[]> {
    const result = await this.executor.query<IdentityDocument>(LIST_DOCUMENTS_FOR_USER_SQL, [userId]);
    return result.rows;
  }

  async listReviewDocuments(status: string | null): Promise<ReviewIdentityDocument[]> {
    const values = status === null ? [] : [status];
    const where = status === null ? "" : 'WHERE d."verificationStatus" = $1';
    const result = await this.executor.query<ReviewIdentityDocument>(`${REVIEW_DOCUMENTS_SQL} ${where} ORDER BY d."verificationStatus" ASC, d."uploadedAt" DESC`, values);
    return result.rows;
  }

  async findCurrentDuplicate(userId: string, documentType: IdentityDocumentType, side: string, sha256: string): Promise<IdentityDocument | null> {
    const result = await this.executor.query<IdentityDocument>(
      'SELECT id,"documentType",side,"originalName",extension,"mimeType","fileSize",sha256,"verificationStatus","uploadedAt","reviewedAt","reviewNotes","expiresAt","isCurrent","storagePath" FROM public.identity_documents WHERE "userId" = $1 AND "documentType" = $2 AND side = $3 AND sha256 = $4 AND "isCurrent" = true LIMIT 1',
      [userId, documentType, side, sha256],
    );
    return result.rows[0] ?? null;
  }

  async replaceCurrentAndCreate(input: { userId: string; documentType: IdentityDocumentType; side: string; storagePath: string; originalName: string; extension: string; mimeType: string; fileSize: number; sha256: string; expiresAt: Date | null }): Promise<IdentityDocument> {
    await this.executor.query(
      'UPDATE public.identity_documents SET "isCurrent" = false,"updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $1 AND "documentType" = $2 AND side = $3 AND "isCurrent" = true',
      [input.userId, input.documentType, input.side],
    );
    const result = await this.executor.query<IdentityDocument>(
      'INSERT INTO public.identity_documents ("userId","uploadedBy","documentType",side,"storagePath","originalName",extension,"mimeType","fileSize",sha256,"verificationStatus","expiresAt","isCurrent","updatedAt") VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,CURRENT_TIMESTAMP) RETURNING id,"documentType",side,"originalName",extension,"mimeType","fileSize",sha256,"verificationStatus","uploadedAt","reviewedAt","reviewNotes","expiresAt","isCurrent","storagePath"',
      [input.userId, input.documentType, input.side, input.storagePath, input.originalName, input.extension, input.mimeType, input.fileSize, input.sha256, "PENDIENTE", input.expiresAt],
    );
    return result.rows[0]!;
  }

  async reviewDocument(documentId: string, reviewerId: string, status: IdentityDocumentStatus, notes: string | null): Promise<{ id: string; verificationStatus: string; reviewedAt: Date | null; reviewNotes: string | null } | null> {
    const existing = await this.executor.query<{ id: string; verificationStatus: IdentityDocumentStatus }>('SELECT id,"verificationStatus" FROM public.identity_documents WHERE id = $1 FOR UPDATE', [documentId]);
    const current = existing.rows[0];
    if (!current) return null;
    const updated = await this.executor.query<{ id: string; verificationStatus: string; reviewedAt: Date | null; reviewNotes: string | null }>(
      'UPDATE public.identity_documents SET "verificationStatus" = $2,"reviewedAt" = CURRENT_TIMESTAMP,"reviewedBy" = $3,"reviewNotes" = $4,"updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id,"verificationStatus","reviewedAt","reviewNotes"',
      [documentId, status, reviewerId, notes],
    );
    await this.executor.query(
      'INSERT INTO public.identity_document_reviews ("identityDocumentId","reviewerId","previousStatus","newStatus",notes) VALUES ($1,$2,$3,$4,$5)',
      [documentId, reviewerId, current.verificationStatus, status, notes],
    );
    return updated.rows[0]!;
  }
}
