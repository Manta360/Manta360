import type { QueryResultRow } from "pg";
import { getMunicipalZone } from "@/lib/municipal-zone";

export type AdminStatistics = {
  propertiesByZone: Array<{ zone: string; count: number }>;
  averageRentByZone: Array<{ zone: string; averageRent: number }>;
  incidentsByStatus: { PENDIENTE: number; EN_PROCESO: number; RESUELTO: number };
  topLandlords: Array<{ id: string; fullName: string; active: boolean; propertiesCount: number }>;
};

type PropertyRow = { address: string; monthlyRentCents: string | number };
type IncidentRow = { status: "PENDIENTE" | "EN_PROCESO" | "RESUELTO"; count: string | number };
type LandlordRow = { id: string; fullName: string; active: boolean; propertiesCount: string | number };

export type AdminStatsSqlResult<Row> = { rows: Row[] };
export interface AdminStatsSqlExecutor {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<AdminStatsSqlResult<Row>>;
}

const PROPERTIES_SQL = `
  SELECT p.address, (p."monthlyRent" * 100)::bigint AS "monthlyRentCents"
  FROM public.properties p
  WHERE p.approved = true AND p.status <> 'INHABILITADO'::"PropertyStatus"
`;

const INCIDENTS_SQL = `
  SELECT status, COUNT(*)::text AS count
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
  return Number(value);
}

export class AdminStatsRepository {
  constructor(private readonly executor: AdminStatsSqlExecutor) {}

  async getStatistics(): Promise<AdminStatistics> {
    const [propertiesResult, incidentsResult, landlordsResult] = await Promise.all([
      this.executor.query<PropertyRow>(PROPERTIES_SQL),
      this.executor.query<IncidentRow>(INCIDENTS_SQL),
      this.executor.query<LandlordRow>(TOP_LANDLORDS_SQL),
    ]);

    const zones = new Map<string, { count: number; totalRentCents: bigint }>();
    for (const property of propertiesResult.rows) {
      const zone = getMunicipalZone(property.address);
      const current = zones.get(zone);
      zones.set(zone, current
        ? { count: current.count + 1, totalRentCents: current.totalRentCents + BigInt(property.monthlyRentCents) }
        : { count: 1, totalRentCents: BigInt(property.monthlyRentCents) });
    }

    const sortedZones = [...zones.entries()]
      .map(([zone, value]) => ({ zone, ...value }))
      .sort((left, right) => right.count - left.count || left.zone.localeCompare(right.zone, "es-EC"));

    const incidentsByStatus: AdminStatistics["incidentsByStatus"] = { PENDIENTE: 0, EN_PROCESO: 0, RESUELTO: 0 };
    for (const incident of incidentsResult.rows) incidentsByStatus[incident.status] = countAsNumber(incident.count);

    return {
      propertiesByZone: sortedZones.map(({ zone, count }) => ({ zone, count })),
      averageRentByZone: sortedZones.map(({ zone, count, totalRentCents }) => ({ zone, averageRent: Number(totalRentCents) / count / 100 })),
      incidentsByStatus,
      topLandlords: landlordsResult.rows.map((landlord) => ({
        id: landlord.id,
        fullName: landlord.fullName,
        active: landlord.active,
        propertiesCount: countAsNumber(landlord.propertiesCount),
      })),
    };
  }
}
