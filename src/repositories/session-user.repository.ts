import type { QueryResultRow } from "pg";
import type { Role } from "@/lib/roles";

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
  role: Role;
  active: boolean;
  createdAt: Date;
};
export type LoginSessionUser = PublicSessionUser & { passwordHash: string };

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

  async findForLogin(identifier: string): Promise<LoginSessionUser | null> {
    const result = await this.executor.query<LoginSessionUser>(
      'SELECT id,email,"fullName" AS "fullName",phone,"nationalId" AS "nationalId",role,active,"createdAt" AT TIME ZONE \'UTC\' AS "createdAt","passwordHash" AS "passwordHash" FROM public.users WHERE LOWER(email) = LOWER($1) OR "nationalId" = $1 LIMIT 1',
      [identifier],
    );
    return result.rows[0] ?? null;
  }

  async createRegisteredUser(input: { id: string; email: string; passwordHash: string; fullName: string; phone: string; nationalId: string; role: Role; updatedAt: Date }): Promise<PublicSessionUser> {
    const result = await this.executor.query<PublicSessionUser>(
      'INSERT INTO public.users (id,email,"passwordHash","fullName",phone,"nationalId",role,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,email,"fullName",phone,"nationalId",role,active,"createdAt"',
      [input.id, input.email, input.passwordHash, input.fullName, input.phone, input.nationalId, input.role, input.updatedAt],
    );
    return result.rows[0]!;
  }
}
