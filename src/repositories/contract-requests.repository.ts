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

  async isTenantIdentityReady(userId: string): Promise<boolean> {
    const result = await this.executor.query<{ documentType: string; side: string }>('SELECT "documentType",side FROM public.identity_documents WHERE "userId" = $1 AND "isCurrent" = true AND "verificationStatus" = \'VERIFICADO\'::"IdentityDocumentStatus"', [userId]);
    const sides = new Set(result.rows.filter((document) => document.documentType === "CEDULA").map((document) => document.side));
    return result.rows.some((document) => document.documentType === "PASAPORTE") || (sides.has("FRENTE") && sides.has("REVERSO"));
  }

  async propertyCanReceiveRequest(propertyId: string): Promise<boolean> {
    const result = await this.executor.query<{ id: string }>('SELECT p.id FROM public.properties p JOIN public.users u ON u.id = p."landlordId" WHERE p.id = $1 AND p.approved = true AND p.status = \'DISPONIBLE\'::"PropertyStatus" AND u.active = true LIMIT 1', [propertyId]);
    return result.rows.length === 1;
  }

  async hasPendingRequest(propertyId: string, tenantId: string): Promise<boolean> {
    const result = await this.executor.query<{ id: string }>('SELECT id FROM public.contract_requests WHERE "propertyId" = $1 AND "tenantId" = $2 AND status = \'PENDIENTE\'::"RequestStatus" LIMIT 1', [propertyId, tenantId]);
    return result.rows.length === 1;
  }

  async createRequest(input: { id: string; propertyId: string; tenantId: string; message: string | null; startDate: Date | null; endDate: Date | null }): Promise<ContractRequest> {
    const result = await this.executor.query<ContractRequest>('INSERT INTO public.contract_requests (id,"propertyId","tenantId",message,"startDate","endDate","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP) RETURNING id,"propertyId","tenantId",status,message,"startDate","endDate","createdAt","updatedAt"', [input.id, input.propertyId, input.tenantId, input.message, input.startDate, input.endDate]);
    return result.rows[0]!;
  }

  async findForLandlordDecision(id: string, landlordId: string): Promise<(ContractRequest & { propertyActive: boolean; propertyApproved: boolean; propertyStatus: string; monthlyRent: string | number }) | null> {
    const result = await this.executor.query<ContractRequest & { propertyActive: boolean; propertyApproved: boolean; propertyStatus: string; monthlyRent: string | number }>(
      'SELECT r.id,r."propertyId",r."tenantId",r.status,r.message,r."startDate",r."endDate",r."createdAt",r."updatedAt",p.approved AS "propertyApproved",p.status AS "propertyStatus",p."monthlyRent" AS "monthlyRent",u.active AS "propertyActive" FROM public.contract_requests r JOIN public.properties p ON p.id = r."propertyId" JOIN public.users u ON u.id = p."landlordId" WHERE r.id = $1 AND p."landlordId" = $2 FOR UPDATE',
      [id, landlordId],
    );
    return result.rows[0] ?? null;
  }

  async setDecision(id: string, status: "APROBADO" | "RECHAZADO"): Promise<ContractRequest> {
    const result = await this.executor.query<ContractRequest>('UPDATE public.contract_requests SET status = $2::"RequestStatus","updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id,"propertyId","tenantId",status,message,"startDate","endDate","createdAt","updatedAt"', [id, status]);
    return result.rows[0]!;
  }

  async hasEffectiveContract(propertyId: string): Promise<boolean> {
    const result = await this.executor.query<{ id: string }>('SELECT id FROM public.contracts WHERE "propertyId" = $1 AND status IN (\'ACTIVO\',\'EN_RENOVACION\') LIMIT 1', [propertyId]);
    return result.rows.length > 0;
  }

  async createPendingContract(input: { id: string; propertyId: string; tenantId: string; landlordId: string; startDate: Date; endDate: Date; monthlyRent: string | number }): Promise<void> {
    await this.executor.query('INSERT INTO public.contracts (id,"propertyId","tenantId","landlordId","startDate","endDate",status,"monthlyRent",city,purpose,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,\'PENDIENTE_FIRMA\'::"ContractStatus",$7,\'Manta\',\'Vivienda\',CURRENT_TIMESTAMP)', [input.id, input.propertyId, input.tenantId, input.landlordId, input.startDate, input.endDate, input.monthlyRent]);
  }
}
