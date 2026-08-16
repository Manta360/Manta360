import type { QueryResultRow } from "pg";

export type MineImage = { id: string; storagePath: string; isPrimary: boolean; displayOrder: number };
export type MineProperty = { id: string; title: string; address: string; monthlyRent: string | number; bedrooms: number | null; bathrooms: number | null; description: string | null; latitude: string | number | null; longitude: string | number | null; status: string; approved: boolean; disableReason: string | null; createdAt: Date; updatedAt: Date; images: MineImage[]; services: string[]; amenities: string[] };
export type PropertiesSqlResult<Row> = { rows: Row[] };
export interface PropertiesSqlExecutor { query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<PropertiesSqlResult<Row>>; }

const PROPERTY_WITH_RELATIONS_SQL = `
  SELECT p.id, p.title, p.address, p."monthlyRent", p.bedrooms, p.bathrooms, p.description, p.latitude, p.longitude, p.status, p.approved, p."disableReason", p."createdAt", p."updatedAt",
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'storagePath', i."storagePath", 'isPrimary', i."isPrimary", 'displayOrder', i."displayOrder") ORDER BY i."isPrimary" DESC, i."displayOrder" ASC, i."createdAt" ASC) FROM public.property_images i WHERE i."propertyId" = p.id), '[]'::jsonb) AS images,
    COALESCE((SELECT jsonb_agg(s.name ORDER BY ps."createdAt" ASC) FROM public.property_services ps JOIN public.service_catalog s ON s.id = ps."serviceId" WHERE ps."propertyId" = p.id), '[]'::jsonb) AS services,
    COALESCE((SELECT jsonb_agg(a.name ORDER BY pa."createdAt" ASC) FROM public.property_amenities pa JOIN public.amenity_catalog a ON a.id = pa."amenityId" WHERE pa."propertyId" = p.id), '[]'::jsonb) AS amenities
  FROM public.properties p
`;

const LIST_MINE_SQL = `
  ${PROPERTY_WITH_RELATIONS_SQL}
  WHERE p."landlordId" = $1
  ORDER BY p."createdAt" DESC
`;

const FIND_MINE_BY_ID_SQL = `
  ${PROPERTY_WITH_RELATIONS_SQL}
  WHERE p.id = $1 AND p."landlordId" = $2
  LIMIT 1
`;

export class PropertiesRepository {
  constructor(private readonly executor: PropertiesSqlExecutor) {}
  async listMineForLandlord(landlordId: string): Promise<MineProperty[]> {
    const result = await this.executor.query<MineProperty>(LIST_MINE_SQL, [landlordId]);
    return result.rows;
  }

  async findMineById(propertyId: string, landlordId: string): Promise<MineProperty | null> {
    const result = await this.executor.query<MineProperty>(FIND_MINE_BY_ID_SQL, [propertyId, landlordId]);
    return result.rows[0] ?? null;
  }
}
