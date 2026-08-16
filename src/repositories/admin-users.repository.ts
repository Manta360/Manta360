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

export class AdminUsersRepository {
  constructor(private readonly executor: AdminUsersSqlExecutor) {}

  async listLandlords(): Promise<AdminLandlord[]> {
    const result = await this.executor.query<AdminLandlordRow>(LIST_LANDLORDS_SQL);
    return result.rows.map((landlord) => ({ ...landlord, propertiesCount: Number(landlord.propertiesCount) }));
  }
}
