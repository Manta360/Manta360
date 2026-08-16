import type { QueryResultRow } from "pg";

export type ActiveSessionUser = {
  id: string;
  active: boolean;
};

export type PublicSessionUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  nationalId: string | null;
  role: string;
  active: boolean;
  createdAt: Date;
};

export type SessionUserSqlResult<Row> = { rows: Row[] };

export interface SessionUserSqlExecutor {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<SessionUserSqlResult<Row>>;
}

const FIND_ACTIVE_SESSION_USER_BY_ID_SQL = `
  SELECT u.id, u.active
  FROM public.users u
  WHERE u.id = $1
`;

const FIND_PUBLIC_SESSION_USER_BY_ID_SQL = `
  SELECT u.id, u.email, u."fullName" AS "fullName", u.phone, u."nationalId" AS "nationalId", u.role, u.active,
    u."createdAt" AT TIME ZONE 'UTC' AS "createdAt"
  FROM public.users u
  WHERE u.id = $1
`;

export class SessionUserRepository {
  constructor(private readonly executor: SessionUserSqlExecutor) {}

  async findActiveSessionUserById(id: string): Promise<ActiveSessionUser | null> {
    const result = await this.executor.query<ActiveSessionUser>(FIND_ACTIVE_SESSION_USER_BY_ID_SQL, [id]);
    return result.rows[0] ?? null;
  }

  async findPublicSessionUserById(id: string): Promise<PublicSessionUser | null> {
    const result = await this.executor.query<PublicSessionUser>(FIND_PUBLIC_SESSION_USER_BY_ID_SQL, [id]);
    return result.rows[0] ?? null;
  }
}
