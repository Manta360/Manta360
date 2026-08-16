import type { QueryResultRow } from "pg";

export type DashboardUser = {
  fullName: string;
  email: string;
  phone: string | null;
  nationalId: string | null;
};

export type LandlordDashboardCounts = {
  properties: number;
  conversations: number;
  documents: number;
};

export type TenantDashboardCounts = {
  requests: number;
  conversations: number;
  documents: number;
};

export type SqlResult<Row> = { rows: Row[] };

export interface DashboardSqlExecutor {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<SqlResult<Row>>;
}

type CountRow = Record<string, string | number>;

function countAsNumber(value: string | number | undefined) {
  return Number(value ?? 0);
}

export class DashboardRepository {
  constructor(private readonly executor: DashboardSqlExecutor) {}

  async findUserById(userId: string): Promise<DashboardUser | null> {
    const result = await this.executor.query<DashboardUser>(
      `SELECT "fullName" AS "fullName", email, phone, "nationalId" AS "nationalId"
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async getLandlordCounts(userId: string): Promise<LandlordDashboardCounts> {
    const result = await this.executor.query<CountRow>(
      `SELECT
        (SELECT COUNT(*) FROM public.properties WHERE "landlordId" = $1) AS properties,
        (SELECT COUNT(*) FROM public.chat_messages WHERE "senderId" = $1 OR "recipientId" = $1) AS conversations,
        (SELECT COUNT(*) FROM public.identity_documents WHERE "userId" = $1 AND "isCurrent" = true AND "verificationStatus" = 'VERIFICADO') AS documents`,
      [userId],
    );
    const row = result.rows[0] ?? {};
    return { properties: countAsNumber(row.properties), conversations: countAsNumber(row.conversations), documents: countAsNumber(row.documents) };
  }

  async getTenantCounts(userId: string): Promise<TenantDashboardCounts> {
    const result = await this.executor.query<CountRow>(
      `SELECT
        (SELECT COUNT(*) FROM public.contract_requests WHERE "tenantId" = $1) AS requests,
        (SELECT COUNT(*) FROM public.chat_messages WHERE "senderId" = $1 OR "recipientId" = $1) AS conversations,
        (SELECT COUNT(*) FROM public.identity_documents WHERE "userId" = $1 AND "isCurrent" = true AND "verificationStatus" = 'VERIFICADO') AS documents`,
      [userId],
    );
    const row = result.rows[0] ?? {};
    return { requests: countAsNumber(row.requests), conversations: countAsNumber(row.conversations), documents: countAsNumber(row.documents) };
  }
}
