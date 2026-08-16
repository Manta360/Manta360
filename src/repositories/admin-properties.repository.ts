import type { QueryResultRow } from "pg";

export type AdminPropertyLandlord = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  nationalId: string | null;
  active: boolean;
  disabledAt: Date | null;
  disableReason: string | null;
};

export type AdminProperty = {
  id: string;
  landlordId: string;
  title: string;
  address: string;
  monthlyRent: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  latitude: string | null;
  longitude: string | null;
  createdBy: string | null;
  approved: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  disabledAt: Date | null;
  disabledBy: string | null;
  disableReason: string | null;
  users_properties_landlordIdTousers: AdminPropertyLandlord;
};

export type AdminPropertyStats = {
  users: number;
  pendingProperties: number;
  occupiedProperties: number;
  activeContracts: number;
  disabledLandlords: number;
  disabledProperties: number;
};

export type AdminPropertiesResult = {
  properties: AdminProperty[];
  stats: AdminPropertyStats;
};

type AdminPropertyRow = Omit<AdminProperty, "monthlyRent" | "users_properties_landlordIdTousers"> & {
  monthlyRent: string | number;
  landlordUserId: string;
  landlordFullName: string;
  landlordEmail: string;
  landlordPhone: string | null;
  landlordNationalId: string | null;
  landlordActive: boolean;
  landlordDisabledAt: Date | null;
  landlordDisableReason: string | null;
};

type AdminPropertyStatsRow = Record<keyof AdminPropertyStats, string | number>;

export type AdminPropertiesSqlResult<Row> = { rows: Row[] };

export interface AdminPropertiesSqlExecutor {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<AdminPropertiesSqlResult<Row>>;
}

const LIST_ADMIN_PROPERTIES_SQL = `
  SELECT
    p.id,
    p."landlordId" AS "landlordId",
    p.title,
    p.address,
    p."monthlyRent"::text AS "monthlyRent",
    p.status,
    p."createdAt" AT TIME ZONE 'UTC' AS "createdAt",
    p."updatedAt" AT TIME ZONE 'UTC' AS "updatedAt",
    p.description,
    p.bedrooms,
    p.bathrooms,
    p.latitude::text AS latitude,
    p.longitude::text AS longitude,
    p."createdBy" AS "createdBy",
    p.approved,
    p."approvedAt" AT TIME ZONE 'UTC' AS "approvedAt",
    p."approvedBy" AS "approvedBy",
    p."disabledAt" AT TIME ZONE 'UTC' AS "disabledAt",
    p."disabledBy" AS "disabledBy",
    p."disableReason" AS "disableReason",
    u.id AS "landlordUserId",
    u."fullName" AS "landlordFullName",
    u.email AS "landlordEmail",
    u.phone AS "landlordPhone",
    u."nationalId" AS "landlordNationalId",
    u.active AS "landlordActive",
    u."disabledAt" AT TIME ZONE 'UTC' AS "landlordDisabledAt",
    u."disableReason" AS "landlordDisableReason"
  FROM public.properties p
  INNER JOIN public.users u ON u.id = p."landlordId"
  ORDER BY p."createdAt" DESC
`;

const ADMIN_PROPERTY_STATS_SQL = `
  SELECT
    (SELECT COUNT(*)::text FROM public.users) AS users,
    (SELECT COUNT(*)::text FROM public.properties WHERE approved = false) AS "pendingProperties",
    (SELECT COUNT(*)::text FROM public.properties WHERE status = 'OCUPADO'::"PropertyStatus") AS "occupiedProperties",
    (SELECT COUNT(*)::text FROM public.contracts WHERE status = 'ACTIVO'::"ContractStatus") AS "activeContracts",
    (SELECT COUNT(*)::text FROM public.users WHERE role = 'ARRENDADOR'::"Role" AND active = false) AS "disabledLandlords",
    (SELECT COUNT(*)::text FROM public.properties WHERE status = 'INHABILITADO'::"PropertyStatus") AS "disabledProperties"
`;

function toNumber(value: string | number) {
  return Number(value);
}

export class AdminPropertiesRepository {
  constructor(private readonly executor: AdminPropertiesSqlExecutor) {}

  async listForMunicipality(): Promise<AdminPropertiesResult> {
    const propertiesResult = await this.executor.query<AdminPropertyRow>(LIST_ADMIN_PROPERTIES_SQL);
    const statsResult = await this.executor.query<AdminPropertyStatsRow>(ADMIN_PROPERTY_STATS_SQL);
    const stats = statsResult.rows[0];

    return {
      properties: propertiesResult.rows.map((property) => ({
        id: property.id,
        landlordId: property.landlordId,
        title: property.title,
        address: property.address,
        monthlyRent: toNumber(property.monthlyRent),
        status: property.status,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt,
        description: property.description,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        latitude: property.latitude,
        longitude: property.longitude,
        createdBy: property.createdBy,
        approved: property.approved,
        approvedAt: property.approvedAt,
        approvedBy: property.approvedBy,
        disabledAt: property.disabledAt,
        disabledBy: property.disabledBy,
        disableReason: property.disableReason,
        users_properties_landlordIdTousers: {
          id: property.landlordUserId,
          fullName: property.landlordFullName,
          email: property.landlordEmail,
          phone: property.landlordPhone,
          nationalId: property.landlordNationalId,
          active: property.landlordActive,
          disabledAt: property.landlordDisabledAt,
          disableReason: property.landlordDisableReason,
        },
      })),
      stats: {
        users: stats ? toNumber(stats.users) : 0,
        pendingProperties: stats ? toNumber(stats.pendingProperties) : 0,
        occupiedProperties: stats ? toNumber(stats.occupiedProperties) : 0,
        activeContracts: stats ? toNumber(stats.activeContracts) : 0,
        disabledLandlords: stats ? toNumber(stats.disabledLandlords) : 0,
        disabledProperties: stats ? toNumber(stats.disabledProperties) : 0,
      },
    };
  }

  async updateApproval(id: string, approved: boolean, approvedBy: string | null, updatedAt: Date): Promise<AdminProperty | null> {
    const result = await this.executor.query<AdminProperty>(
      'UPDATE public.properties SET approved = $2,"approvedAt" = $3,"approvedBy" = $4,"updatedAt" = $5 WHERE id = $1 RETURNING id,"landlordId",title,address,"monthlyRent",status,"createdAt","updatedAt",description,bedrooms,bathrooms,latitude,longitude,"createdBy",approved,"approvedAt","approvedBy","disabledAt","disabledBy","disableReason"',
      [id, approved, approved ? updatedAt : null, approved ? approvedBy : null, updatedAt],
    );
    return result.rows[0] ?? null;
  }

  async findPropertyStatus(id: string): Promise<{ id: string; status: string } | null> {
    const result = await this.executor.query<{ id: string; status: string }>('SELECT id,status FROM public.properties WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async disableProperty(id: string, disabledBy: string, reason: string, updatedAt: Date): Promise<AdminProperty | null> {
    const result = await this.executor.query<AdminProperty>(
      'UPDATE public.properties SET status = $2,approved = false,"approvedAt" = NULL,"approvedBy" = NULL,"disabledAt" = $3,"disabledBy" = $4,"disableReason" = $5,"updatedAt" = $3 WHERE id = $1 RETURNING id,"landlordId",title,address,"monthlyRent",status,"createdAt","updatedAt",description,bedrooms,bathrooms,latitude,longitude,"createdBy",approved,"approvedAt","approvedBy","disabledAt","disabledBy","disableReason"',
      [id, "INHABILITADO", updatedAt, disabledBy, reason],
    );
    return result.rows[0] ?? null;
  }
}
