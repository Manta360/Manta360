import type { QueryResultRow } from "pg";
import { synchronizePropertyContractState } from "@/lib/property-contract-state";

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

export type ContractDetailProperty = {
  id: string;
  landlordId: string;
  title: string;
  address: string;
  monthlyRent: string | number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  latitude: string | number | null;
  longitude: string | number | null;
  createdBy: string | null;
  approved: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  disabledAt: Date | null;
  disabledBy: string | null;
  disableReason: string | null;
};

export type ContractDetailItem = Omit<ContractListItem, "properties"> & { properties: ContractDetailProperty };

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

const FIND_CONTRACT_BY_ID_SQL = `
  SELECT c.id, c."propertyId", c."tenantId", c."landlordId", c."startDate", c."endDate", c.status,
    c."monthlyRent", c.city, c.province, c.canton, c.parish, c.neighborhood, c.street, c."houseNumber", c.intersection, c.purpose,
    c."depositAmount", c."paymentMethod", c."landlordSignedAt", c."tenantSignedAt", c."municipalReviewedAt", c."municipalReviewedBy",
    c."municipalReviewNotes", c."endedAt", c."endedBy", c."createdAt", c."updatedAt",
    p.id AS "detailPropertyId", p."landlordId" AS "detailPropertyLandlordId", p.title AS "detailPropertyTitle", p.address AS "detailPropertyAddress",
    p."monthlyRent" AS "detailPropertyMonthlyRent", p.status AS "detailPropertyStatus", p."createdAt" AS "detailPropertyCreatedAt", p."updatedAt" AS "detailPropertyUpdatedAt",
    p.description AS "detailPropertyDescription", p.bedrooms AS "detailPropertyBedrooms", p.bathrooms AS "detailPropertyBathrooms", p.latitude AS "detailPropertyLatitude", p.longitude AS "detailPropertyLongitude",
    p."createdBy" AS "detailPropertyCreatedBy", p.approved AS "detailPropertyApproved", p."approvedAt" AS "detailPropertyApprovedAt", p."approvedBy" AS "detailPropertyApprovedBy",
    p."disabledAt" AS "detailPropertyDisabledAt", p."disabledBy" AS "detailPropertyDisabledBy", p."disableReason" AS "detailPropertyDisableReason",
    jsonb_build_object('id', tenant.id, 'fullName', tenant."fullName", 'email', tenant.email, 'phone', tenant.phone, 'nationalId', tenant."nationalId") AS "users_contracts_tenantIdTousers",
    jsonb_build_object('id', landlord.id, 'fullName', landlord."fullName", 'email', landlord.email, 'phone', landlord.phone, 'nationalId', landlord."nationalId") AS "users_contracts_landlordIdTousers"
  FROM public.contracts c
  JOIN public.properties p ON p.id = c."propertyId"
  JOIN public.users tenant ON tenant.id = c."tenantId"
  JOIN public.users landlord ON landlord.id = c."landlordId"
  WHERE c.id = $1
  LIMIT 1
`;

type ContractDetailRow = Omit<ContractDetailItem, "properties"> & {
  detailPropertyId: string;
  detailPropertyLandlordId: string;
  detailPropertyTitle: string;
  detailPropertyAddress: string;
  detailPropertyMonthlyRent: string | number;
  detailPropertyStatus: string;
  detailPropertyCreatedAt: Date;
  detailPropertyUpdatedAt: Date;
  detailPropertyDescription: string | null;
  detailPropertyBedrooms: number | null;
  detailPropertyBathrooms: number | null;
  detailPropertyLatitude: string | number | null;
  detailPropertyLongitude: string | number | null;
  detailPropertyCreatedBy: string | null;
  detailPropertyApproved: boolean;
  detailPropertyApprovedAt: Date | null;
  detailPropertyApprovedBy: string | null;
  detailPropertyDisabledAt: Date | null;
  detailPropertyDisabledBy: string | null;
  detailPropertyDisableReason: string | null;
};

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

  async findById(id: string): Promise<ContractDetailItem | null> {
    const result = await this.executor.query<ContractDetailRow>(FIND_CONTRACT_BY_ID_SQL, [id]);
    const row = result.rows[0];
    if (!row) return null;
    const {
      detailPropertyId, detailPropertyLandlordId, detailPropertyTitle, detailPropertyAddress, detailPropertyMonthlyRent, detailPropertyStatus,
      detailPropertyCreatedAt, detailPropertyUpdatedAt, detailPropertyDescription, detailPropertyBedrooms, detailPropertyBathrooms,
      detailPropertyLatitude, detailPropertyLongitude, detailPropertyCreatedBy, detailPropertyApproved, detailPropertyApprovedAt,
      detailPropertyApprovedBy, detailPropertyDisabledAt, detailPropertyDisabledBy, detailPropertyDisableReason,
      ...contract
    } = row;
    return {
      ...contract,
      properties: {
        id: detailPropertyId, landlordId: detailPropertyLandlordId, title: detailPropertyTitle, address: detailPropertyAddress,
        monthlyRent: detailPropertyMonthlyRent, status: detailPropertyStatus, createdAt: detailPropertyCreatedAt, updatedAt: detailPropertyUpdatedAt,
        description: detailPropertyDescription, bedrooms: detailPropertyBedrooms, bathrooms: detailPropertyBathrooms,
        latitude: detailPropertyLatitude, longitude: detailPropertyLongitude, createdBy: detailPropertyCreatedBy, approved: detailPropertyApproved,
        approvedAt: detailPropertyApprovedAt, approvedBy: detailPropertyApprovedBy, disabledAt: detailPropertyDisabledAt,
        disabledBy: detailPropertyDisabledBy, disableReason: detailPropertyDisableReason,
      },
    };
  }

  async updatePreparation(id: string, fields: Record<string, unknown>): Promise<ContractListItem | null> {
    const columns = new Set(["city", "province", "canton", "parish", "neighborhood", "street", "houseNumber", "intersection", "purpose", "paymentMethod", "monthlyRent", "depositAmount", "startDate", "endDate"]);
    const values: unknown[] = [id];
    const sets: string[] = ['"updatedAt" = CURRENT_TIMESTAMP'];
    for (const [field, value] of Object.entries(fields)) {
      if (value === undefined || !columns.has(field)) continue;
      values.push(value);
      sets.push(`"${field}" = $${values.length}`);
    }
    const result = await this.executor.query<ContractListItem>(`UPDATE public.contracts SET ${sets.join(", ")} WHERE id = $1 AND status = 'PENDIENTE_FIRMA'::"ContractStatus" RETURNING id,"propertyId","tenantId","landlordId","startDate","endDate",status,"monthlyRent",city,province,canton,parish,neighborhood,street,"houseNumber",intersection,purpose,"depositAmount","paymentMethod","landlordSignedAt","tenantSignedAt","municipalReviewedAt","municipalReviewedBy","municipalReviewNotes","endedAt","endedBy","createdAt","updatedAt"`, values);
    return result.rows[0] ?? null;
  }

  async signPendingContract(id: string, userId: string): Promise<{ tenantSignedAt: Date | null; landlordSignedAt: Date | null } | null> {
    const result = await this.executor.query<{ tenantId: string; landlordId: string; status: string; tenantSignedAt: Date | null; landlordSignedAt: Date | null }>('SELECT "tenantId","landlordId",status,"tenantSignedAt","landlordSignedAt" FROM public.contracts WHERE id = $1 FOR UPDATE', [id]);
    const contract = result.rows[0];
    if (!contract || contract.status !== "PENDIENTE_FIRMA" || (contract.tenantId !== userId && contract.landlordId !== userId)) return null;
    const column = contract.tenantId === userId ? '"tenantSignedAt"' : '"landlordSignedAt"';
    const updated = await this.executor.query<{ tenantSignedAt: Date | null; landlordSignedAt: Date | null }>(`UPDATE public.contracts SET ${column} = CURRENT_TIMESTAMP,"updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING "tenantSignedAt","landlordSignedAt"`, [id]);
    const signed = updated.rows[0]!;
    if (signed.tenantSignedAt && signed.landlordSignedAt) await this.executor.query('UPDATE public.contracts SET status = \'PENDIENTE_MUNICIPIO\'::"ContractStatus","updatedAt" = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    return signed;
  }

  async reconcileExpiredContracts(now: Date): Promise<number> {
    const expired = await this.executor.query<ExpiredContract>(
      'SELECT id, "propertyId" FROM public.contracts WHERE status IN (\'ACTIVO\', \'EN_RENOVACION\') AND "endDate" < $1 FOR UPDATE',
      [now],
    );
    let finalized = 0;
    for (const contract of expired.rows) {
      const updated = await this.executor.query<{ id: string }>(
        'UPDATE public.contracts SET status = \'FINALIZADO\'::"ContractStatus", "endedAt" = $2, "endedBy" = NULL, "updatedAt" = $2 WHERE id = $1 AND status IN (\'ACTIVO\', \'EN_RENOVACION\') AND "endDate" < $2 RETURNING id',
        [contract.id, now],
      );
      if (updated.rows.length !== 1) continue;
      finalized += 1;
      await synchronizePropertyContractState(this.executor, contract.propertyId, now);
    }
    return finalized;
  }
}
