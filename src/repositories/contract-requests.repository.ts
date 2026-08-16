import type { QueryResultRow } from "pg";

export type ContractRequestUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  nationalId: string | null;
};

export type ContractRequest = {
  id: string;
  propertyId: string;
  tenantId: string;
  status: string;
  message: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  properties: {
    id: string;
    title: string;
    address: string;
    monthlyRent: string | number;
    landlordId: string;
  };
  users: ContractRequestUser;
};

export type ContractRequestsSqlResult<Row> = { rows: Row[] };
export interface ContractRequestsSqlExecutor {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<ContractRequestsSqlResult<Row>>;
}

const BASE_QUERY = `
  SELECT r.id, r."propertyId", r."tenantId", r.status, r.message, r."startDate", r."endDate", r."createdAt", r."updatedAt",
    jsonb_build_object('id', p.id, 'title', p.title, 'address', p.address, 'monthlyRent', p."monthlyRent", 'landlordId', p."landlordId") AS properties,
    jsonb_build_object('id', u.id, 'fullName', u."fullName", 'email', u.email, 'phone', u.phone, 'nationalId', u."nationalId") AS users
  FROM public.contract_requests r
  JOIN public.properties p ON p.id = r."propertyId"
  JOIN public.users u ON u.id = r."tenantId"
`;

export class ContractRequestsRepository {
  constructor(private readonly executor: ContractRequestsSqlExecutor) {}

  async listForSession(role: string, userId: string): Promise<ContractRequest[]> {
    const where = role === "ARRENDATARIO"
      ? 'WHERE r."tenantId" = $1'
      : role === "ARRENDADOR"
        ? 'WHERE p."landlordId" = $1'
        : "";
    const result = await this.executor.query<ContractRequest>(
      `${BASE_QUERY} ${where} ORDER BY r."createdAt" DESC`,
      where ? [userId] : [],
    );
    return result.rows;
  }
}
