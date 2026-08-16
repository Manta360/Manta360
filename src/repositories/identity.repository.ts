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
}
