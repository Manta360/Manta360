import type { QueryResultRow } from "pg";

export type ContractUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  nationalId: string | null;
};

export type ContractListItem = {
  id: string;
  propertyId: string;
  tenantId: string;
  landlordId: string;
  startDate: Date;
  endDate: Date;
  status: string;
  monthlyRent: string | number | null;
  city: string | null;
  province: string | null;
  canton: string | null;
  parish: string | null;
  neighborhood: string | null;
  street: string | null;
  houseNumber: string | null;
  intersection: string | null;
  purpose: string | null;
  depositAmount: string | number | null;
  paymentMethod: string | null;
  landlordSignedAt: Date | null;
  tenantSignedAt: Date | null;
  municipalReviewedAt: Date | null;
  municipalReviewedBy: string | null;
  municipalReviewNotes: string | null;
  endedAt: Date | null;
  endedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  properties: { id: string; title: string; address: string };
  users_contracts_tenantIdTousers: ContractUser;
  users_contracts_landlordIdTousers: ContractUser;
};

export type ExpiredContract = { id: string; propertyId: string };

export type ContractsSqlResult<Row> = { rows: Row[]; rowCount?: number | null };
export interface ContractsSqlExecutor {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<ContractsSqlResult<Row>>;
}

const LIST_CONTRACTS_SQL = `
  SELECT c.id, c."propertyId", c."tenantId", c."landlordId", c."startDate", c."endDate", c.status,
    c."monthlyRent", c.city, c.province, c.canton, c.parish, c.neighborhood, c.street, c."houseNumber", c.intersection, c.purpose,
    c."depositAmount", c."paymentMethod", c."landlordSignedAt", c."tenantSignedAt", c."municipalReviewedAt", c."municipalReviewedBy",
    c."municipalReviewNotes", c."endedAt", c."endedBy", c."createdAt", c."updatedAt",
    jsonb_build_object('id', p.id, 'title', p.title, 'address', p.address) AS properties,
    jsonb_build_object('id', tenant.id, 'fullName', tenant."fullName", 'email', tenant.email, 'phone', tenant.phone, 'nationalId', tenant."nationalId") AS "users_contracts_tenantIdTousers",
    jsonb_build_object('id', landlord.id, 'fullName', landlord."fullName", 'email', landlord.email, 'phone', landlord.phone, 'nationalId', landlord."nationalId") AS "users_contracts_landlordIdTousers"
  FROM public.contracts c
  JOIN public.properties p ON p.id = c."propertyId"
  JOIN public.users tenant ON tenant.id = c."tenantId"
  JOIN public.users landlord ON landlord.id = c."landlordId"
`;

export class ContractsRepository {
  constructor(private readonly executor: ContractsSqlExecutor) {}

  async listForSession(role: string, userId: string): Promise<ContractListItem[]> {
    const where = role === "ARRENDATARIO"
      ? 'WHERE c."tenantId" = $1'
      : role === "ARRENDADOR"
        ? 'WHERE c."landlordId" = $1'
        : "";
    const result = await this.executor.query<ContractListItem>(
      `${LIST_CONTRACTS_SQL} ${where} ORDER BY c."createdAt" DESC`,
      where ? [userId] : [],
    );
    return result.rows;
  }

  async reconcileExpiredContracts(now: Date): Promise<number> {
    const expired = await this.executor.query<ExpiredContract>(
      'SELECT id, "propertyId" FROM public.contracts WHERE status IN (\'ACTIVO\', \'EN_RENOVACION\') AND "endDate" < $1',
      [now],
    );
    let finalized = 0;
    for (const contract of expired.rows) {
      const updated = await this.executor.query<{ id: string }>(
        'UPDATE public.contracts SET status = \'FINALIZADO\', "endedAt" = $2, "endedBy" = NULL, "updatedAt" = $2 WHERE id = $1 AND status IN (\'ACTIVO\', \'EN_RENOVACION\') AND "endDate" < $2 RETURNING id',
        [contract.id, now],
      );
      if (updated.rows.length !== 1) continue;
      finalized += 1;
      await this.synchronizePropertyContractState(contract.propertyId, now);
    }
    return finalized;
  }

  private async synchronizePropertyContractState(propertyId: string, now: Date) {
    const property = await this.executor.query<{ id: string; status: string }>(
      'SELECT id, status FROM public.properties WHERE id = $1',
      [propertyId],
    );
    const current = property.rows[0];
    if (!current || current.status === "MANTENIMIENTO" || current.status === "INHABILITADO") return false;

    const effective = await this.executor.query<{ id: string }>(
      'SELECT id FROM public.contracts WHERE "propertyId" = $1 AND status IN (\'ACTIVO\', \'EN_RENOVACION\') LIMIT 1',
      [propertyId],
    );
    const expected = effective.rows.length > 0 ? "OCUPADO" : "DISPONIBLE";
    if (current.status === expected) return false;
    const changed = await this.executor.query<{ id: string }>(
      'UPDATE public.properties SET status = $2::"PropertyStatus", "updatedAt" = $3 WHERE id = $1 AND status IN (\'DISPONIBLE\', \'OCUPADO\') RETURNING id',
      [propertyId, expected, now],
    );
    return changed.rows.length === 1;
  }
}
