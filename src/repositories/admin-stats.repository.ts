import type { QueryResultRow } from "pg";
import { getMunicipalZone } from "@/lib/municipal-zone";

export type AdminStatistics = {
  propertiesByZone: Array<{ zone: string; count: number }>;
  averageRentByZone: Array<{ zone: string; averageRent: number }>;
  incidentsByStatus: { PENDIENTE: number; EN_PROCESO: number; RESUELTO: number };
  topLandlords: Array<{ id: string; fullName: string; active: boolean; propertiesCount: number }>;
};

type PropertyRow = { address: string; monthlyRentCents: string | number };
type IncidentRow = { status: string; count: string | number };
type LandlordRow = { id: string; fullName: string; active: boolean; propertiesCount: string | number };

export type AdminStatsSqlResult<Row> = { rows: Row[] };
export interface AdminStatsSqlExecutor {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<AdminStatsSqlResult<Row>>;
}

const INCIDENT_STATUSES = ["PENDIENTE", "EN_PROCESO", "RESUELTO"] as const;

const PROPERTIES_SQL = `
  SELECT p.address, (p."monthlyRent" * 100)::bigint AS "monthlyRentCents"
  FROM public.properties p
  WHERE p.approved = true AND p.status <> 'INHABILITADO'::"PropertyStatus"
`;

const INCIDENTS_SQL = `
  SELECT status::text AS status, COUNT(*)::text AS count
  FROM public.incident_reports
  GROUP BY status
`;

const TOP_LANDLORDS_SQL = `
  SELECT u.id, u."fullName" AS "fullName", u.active, COUNT(p.id)::text AS "propertiesCount"
  FROM public.users u
  LEFT JOIN public.properties p ON p."landlordId" = u.id
  WHERE u.role = 'ARRENDADOR'::"Role"
  GROUP BY u.id, u."fullName", u.active
  ORDER BY COUNT(p.id) DESC, u."fullName" ASC, u.id ASC
  LIMIT 5
`;

function countAsNumber(value: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function averageRentFromCents(totalRentCents: bigint, count: number): number {
  if (count <= 0) return 0;
  return Number(totalRentCents) / count / 100;
}

function emptyIncidentsByStatus(): AdminStatistics["incidentsByStatus"] {
  return { PENDIENTE: 0, EN_PROCESO: 0, RESUELTO: 0 };
}

export class AdminStatsRepository {
  constructor(private readonly executor: AdminStatsSqlExecutor) {}

  async getStatistics(): Promise<AdminStatistics> {
    // Sequential queries: one checkout at a time under Supabase Session Pooler limits.
    const propertiesResult = await this.executor.query<PropertyRow>(PROPERTIES_SQL);
    const incidentsResult = await this.executor.query<IncidentRow>(INCIDENTS_SQL);
    const landlordsResult = await this.executor.query<LandlordRow>(TOP_LANDLORDS_SQL);

    const zones = new Map<string, { count: number; totalRentCents: bigint }>();
    for (const property of propertiesResult.rows) {
      const zone = getMunicipalZone(property.address);
      const rentCents = BigInt(property.monthlyRentCents);
      const current = zones.get(zone);
      zones.set(
        zone,
        current
          ? { count: current.count + 1, totalRentCents: current.totalRentCents + rentCents }
          : { count: 1, totalRentCents: rentCents },
      );
    }

    const sortedZones = [...zones.entries()]
      .map(([zone, value]) => ({ zone, ...value }))
      .sort((left, right) => right.count - left.count || left.zone.localeCompare(right.zone, "es-EC"));

    const incidentsByStatus = emptyIncidentsByStatus();
    for (const incident of incidentsResult.rows) {
      if ((INCIDENT_STATUSES as readonly string[]).includes(incident.status)) {
        incidentsByStatus[incident.status as keyof typeof incidentsByStatus] = countAsNumber(incident.count);
      }
    }

    return {
      propertiesByZone: sortedZones.map(({ zone, count }) => ({ zone, count })),
      averageRentByZone: sortedZones.map(({ zone, count, totalRentCents }) => ({
        zone,
        averageRent: averageRentFromCents(totalRentCents, count),
      })),
      incidentsByStatus,
      topLandlords: landlordsResult.rows.slice(0, 5).map((landlord) => ({
        id: landlord.id,
        fullName: landlord.fullName,
        active: landlord.active,
        propertiesCount: countAsNumber(landlord.propertiesCount),
      })),
    };
  }
}
