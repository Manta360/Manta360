import type { QueryResultRow } from "pg";

export type AdminLandlord = {
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

export type AdminLandlordDetail = Omit<AdminLandlord, "propertiesCount">;
export type NewAdminLandlord = Omit<AdminLandlordDetail, "active" | "disabledAt" | "disabledBy" | "disableReason" | "createdAt" | "updatedAt">;

type AdminLandlordRow = Omit<AdminLandlord, "propertiesCount"> & { propertiesCount: string | number };

export type AdminUsersSqlResult<Row> = { rows: Row[] };
export interface AdminUsersSqlExecutor {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<AdminUsersSqlResult<Row>>;
}

const LIST_LANDLORDS_SQL = `
  SELECT u.id, u."fullName" AS "fullName", u.email, u.phone, u."nationalId" AS "nationalId", u.role, u.active,
    u."disabledAt" AT TIME ZONE 'UTC' AS "disabledAt", u."disabledBy" AS "disabledBy", u."disableReason" AS "disableReason",
    u."createdAt" AT TIME ZONE 'UTC' AS "createdAt", u."updatedAt" AT TIME ZONE 'UTC' AS "updatedAt",
    COUNT(p.id)::text AS "propertiesCount"
  FROM public.users u
  LEFT JOIN public.properties p ON p."landlordId" = u.id
  WHERE u.role = 'ARRENDADOR'::"Role"
  GROUP BY u.id, u."fullName", u.email, u.phone, u."nationalId", u.role, u.active, u."disabledAt", u."disabledBy", u."disableReason", u."createdAt", u."updatedAt"
  ORDER BY u."createdAt" DESC
`;

const FIND_LANDLORD_BY_ID_SQL = `
  SELECT u.id, u."fullName" AS "fullName", u.email, u.phone, u."nationalId" AS "nationalId", u.role, u.active,
    u."disabledAt" AT TIME ZONE 'UTC' AS "disabledAt", u."disabledBy" AS "disabledBy", u."disableReason" AS "disableReason",
    u."createdAt" AT TIME ZONE 'UTC' AS "createdAt", u."updatedAt" AT TIME ZONE 'UTC' AS "updatedAt"
  FROM public.users u
  WHERE u.id = $1 AND u.role = 'ARRENDADOR'::"Role"
`;

export class AdminUsersRepository {
  constructor(private readonly executor: AdminUsersSqlExecutor) {}

  async listLandlords(): Promise<AdminLandlord[]> {
    const result = await this.executor.query<AdminLandlordRow>(LIST_LANDLORDS_SQL);
    return result.rows.map((landlord) => ({ ...landlord, propertiesCount: Number(landlord.propertiesCount) }));
  }

  async findLandlordById(id: string): Promise<AdminLandlordDetail | null> {
    const result = await this.executor.query<AdminLandlordDetail>(FIND_LANDLORD_BY_ID_SQL, [id]);
    return result.rows[0] ?? null;
  }

  async createLandlord(input: { id: string; fullName: string; email: string; phone: string; nationalId: string; passwordHash: string; updatedAt: Date }): Promise<AdminLandlordDetail> {
    const result = await this.executor.query<AdminLandlordDetail>(
      'INSERT INTO public.users (id,"fullName",email,phone,"nationalId","passwordHash",role,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,"fullName",email,phone,"nationalId",role,active,"disabledAt","disabledBy","disableReason","createdAt","updatedAt"',
      [input.id, input.fullName, input.email, input.phone, input.nationalId, input.passwordHash, "ARRENDADOR", input.updatedAt],
    );
    return result.rows[0]!;
  }

  async updateLandlord(id: string, data: Partial<Pick<AdminLandlordDetail, "fullName" | "email" | "phone" | "nationalId" | "active" | "disabledAt" | "disabledBy" | "disableReason">>): Promise<AdminLandlordDetail | null> {
    const map: Record<string, string> = { fullName: "fullName", email: "email", phone: "phone", nationalId: "nationalId", active: "active", disabledAt: "disabledAt", disabledBy: "disabledBy", disableReason: "disableReason" };
    const values: unknown[] = [id]; const sets = ['"updatedAt" = CURRENT_TIMESTAMP'];
    for (const [key, column] of Object.entries(map)) if (data[key as keyof typeof data] !== undefined) { values.push(data[key as keyof typeof data]); sets.push(`"${column}" = $${values.length}`); }
    const result = await this.executor.query<AdminLandlordDetail>(`UPDATE public.users SET ${sets.join(", ")} WHERE id=$1 AND role='ARRENDADOR'::"Role" RETURNING id,"fullName",email,phone,"nationalId",role,active,"disabledAt","disabledBy","disableReason","createdAt","updatedAt"`, values);
    return result.rows[0] ?? null;
  }
}
