import type { QueryResultRow } from "pg";

export type AdminManagedRole = "ARRENDADOR" | "ARRENDATARIO";

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  nationalId: string | null;
  role: string;
  active: boolean;
  disabledAt: Date | null;
  disabledBy: string | null;
  disableReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  propertiesCount: number;
};

export type AdminUserDetail = Omit<AdminUser, "propertiesCount">;
/** @deprecated Prefer AdminUser; kept for landlord-specific write paths. */
export type AdminLandlord = AdminUser;
/** @deprecated Prefer AdminUserDetail. */
export type AdminLandlordDetail = AdminUserDetail;
export type NewAdminLandlord = Omit<AdminLandlordDetail, "active" | "disabledAt" | "disabledBy" | "disableReason" | "createdAt" | "updatedAt">;

export type AdminUserListFilters = {
  role?: AdminManagedRole | null;
  search?: string | null;
};

type AdminUserRow = Omit<AdminUser, "propertiesCount"> & { propertiesCount: string | number };

export type AdminUsersSqlResult<Row> = { rows: Row[] };
export interface AdminUsersSqlExecutor {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<AdminUsersSqlResult<Row>>;
}

const SAFE_USER_COLUMNS = `
  u.id, u."fullName" AS "fullName", u.email, u.phone, u."nationalId" AS "nationalId", u.role, u.active,
  u."disabledAt" AT TIME ZONE 'UTC' AS "disabledAt", u."disabledBy" AS "disabledBy", u."disableReason" AS "disableReason",
  u."createdAt" AT TIME ZONE 'UTC' AS "createdAt", u."updatedAt" AT TIME ZONE 'UTC' AS "updatedAt"
`;

function buildListUsersQuery(filters: AdminUserListFilters) {
  const values: unknown[] = [];
  const clauses = [`u.role IN ('ARRENDADOR'::"Role", 'ARRENDATARIO'::"Role")`];

  if (filters.role) {
    values.push(filters.role);
    clauses.push(`u.role = $${values.length}::"Role"`);
  }

  const search = filters.search?.trim();
  if (search) {
    values.push(search);
    const index = values.length;
    clauses.push(`(u."fullName" ILIKE '%' || $${index} || '%' OR u.email ILIKE '%' || $${index} || '%' OR COALESCE(u."nationalId", '') ILIKE '%' || $${index} || '%')`);
  }

  const text = `
  SELECT ${SAFE_USER_COLUMNS},
    COUNT(p.id)::text AS "propertiesCount"
  FROM public.users u
  LEFT JOIN public.properties p ON p."landlordId" = u.id
  WHERE ${clauses.join(" AND ")}
  GROUP BY u.id, u."fullName", u.email, u.phone, u."nationalId", u.role, u.active, u."disabledAt", u."disabledBy", u."disableReason", u."createdAt", u."updatedAt"
  ORDER BY u."createdAt" DESC
`;

  return { text, values };
}

export class AdminUsersRepository {
  constructor(private readonly executor: AdminUsersSqlExecutor) {}

  async listUsers(filters: AdminUserListFilters = {}): Promise<AdminUser[]> {
    const query = buildListUsersQuery(filters);
    const result = await this.executor.query<AdminUserRow>(query.text, query.values);
    return result.rows.map((user) => ({ ...user, propertiesCount: Number(user.propertiesCount) }));
  }

  async listLandlords(): Promise<AdminUser[]> {
    return this.listUsers({ role: "ARRENDADOR" });
  }

  async findManagedUserById(id: string): Promise<AdminUserDetail | null> {
    const result = await this.executor.query<AdminUserDetail>(
      `SELECT ${SAFE_USER_COLUMNS}
       FROM public.users u
       WHERE u.id = $1 AND u.role IN ('ARRENDADOR'::"Role", 'ARRENDATARIO'::"Role")`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findLandlordById(id: string): Promise<AdminUserDetail | null> {
    const result = await this.executor.query<AdminUserDetail>(
      `SELECT ${SAFE_USER_COLUMNS}
       FROM public.users u
       WHERE u.id = $1 AND u.role = 'ARRENDADOR'::"Role"`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async createLandlord(input: { id: string; fullName: string; email: string; phone: string; nationalId: string; passwordHash: string; updatedAt: Date }): Promise<AdminUserDetail> {
    const result = await this.executor.query<AdminUserDetail>(
      'INSERT INTO public.users (id,"fullName",email,phone,"nationalId","passwordHash",role,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,"fullName",email,phone,"nationalId",role,active,"disabledAt","disabledBy","disableReason","createdAt","updatedAt"',
      [input.id, input.fullName, input.email, input.phone, input.nationalId, input.passwordHash, "ARRENDADOR", input.updatedAt],
    );
    return result.rows[0]!;
  }

  async updateLandlord(id: string, data: Partial<Pick<AdminUserDetail, "fullName" | "email" | "phone" | "nationalId" | "active" | "disabledAt" | "disabledBy" | "disableReason">>): Promise<AdminUserDetail | null> {
    const map: Record<string, string> = { fullName: "fullName", email: "email", phone: "phone", nationalId: "nationalId", active: "active", disabledAt: "disabledAt", disabledBy: "disabledBy", disableReason: "disableReason" };
    const values: unknown[] = [id];
    const sets = ['"updatedAt" = CURRENT_TIMESTAMP'];
    for (const [key, column] of Object.entries(map)) {
      if (data[key as keyof typeof data] !== undefined) {
        values.push(data[key as keyof typeof data]);
        sets.push(`"${column}" = $${values.length}`);
      }
    }
    const result = await this.executor.query<AdminUserDetail>(
      `UPDATE public.users SET ${sets.join(", ")} WHERE id=$1 AND role='ARRENDADOR'::"Role" RETURNING id,"fullName",email,phone,"nationalId",role,active,"disabledAt","disabledBy","disableReason","createdAt","updatedAt"`,
      values,
    );
    return result.rows[0] ?? null;
  }
}
