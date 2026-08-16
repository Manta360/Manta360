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

export type IdentitySqlResult<Row> = { rows: Row[] };
export interface IdentitySqlExecutor { query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<IdentitySqlResult<Row>>; }

const LIST_DOCUMENTS_FOR_USER_SQL = `
  SELECT id, "documentType", side, "originalName", extension, "mimeType", "fileSize", sha256,
    "verificationStatus", "uploadedAt", "reviewedAt", "reviewNotes", "expiresAt", "isCurrent", "storagePath"
  FROM public.identity_documents
  WHERE "userId" = $1
  ORDER BY "isCurrent" DESC, "uploadedAt" DESC
`;

export class IdentityRepository {
  constructor(private readonly executor: IdentitySqlExecutor) {}

  async listDocumentsForUser(userId: string): Promise<IdentityDocument[]> {
    const result = await this.executor.query<IdentityDocument>(LIST_DOCUMENTS_FOR_USER_SQL, [userId]);
    return result.rows;
  }
}
