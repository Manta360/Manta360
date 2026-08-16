import type { QueryResultRow } from "pg";

export type MineImage = { id: string; storagePath: string; isPrimary: boolean; displayOrder: number };
export type PropertyImageRead = { id: string; storagePath: string; isPrimary: boolean; displayOrder: number };
export type MineProperty = { id: string; title: string; address: string; monthlyRent: string | number; bedrooms: number | null; bathrooms: number | null; description: string | null; latitude: string | number | null; longitude: string | number | null; status: string; approved: boolean; disableReason: string | null; createdAt: Date; updatedAt: Date; images: MineImage[]; services: string[]; amenities: string[] };
export type CatalogProperty = { id: string; title: string; address: string; monthlyRent: string | number; status: string; description: string | null; bedrooms: number | null; bathrooms: number | null; latitude: string | number | null; longitude: string | number | null; landlord: { id: string; fullName: string }; createdAt: Date; updatedAt: Date; images: MineImage[]; services: string[]; amenities: string[] };
export type CatalogPropertyFilters = { minPrice: number | null; maxPrice: number | null; services: string[] };
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

const FIND_OWNED_PROPERTY_FOR_IMAGES_SQL = `
  SELECT p.id
  FROM public.properties p
  WHERE p.id = $1 AND p."landlordId" = $2
  LIMIT 1
`;

const LIST_PROPERTY_IMAGES_SQL = `
  SELECT i.id, i."storagePath", i."isPrimary", i."displayOrder"
  FROM public.property_images i
  WHERE i."propertyId" = $1
  ORDER BY i."isPrimary" DESC, i."displayOrder" ASC, i."createdAt" ASC
`;

const CATALOG_PROPERTY_WITH_RELATIONS_SQL = `
  SELECT p.id, p.title, p.address, p."monthlyRent", p.status, p.description, p.bedrooms, p.bathrooms, p.latitude, p.longitude, p."createdAt", p."updatedAt",
    jsonb_build_object('id', u.id, 'fullName', u."fullName") AS landlord,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'storagePath', i."storagePath", 'isPrimary', i."isPrimary", 'displayOrder', i."displayOrder") ORDER BY i."isPrimary" DESC, i."displayOrder" ASC, i."createdAt" ASC) FROM public.property_images i WHERE i."propertyId" = p.id), '[]'::jsonb) AS images,
    COALESCE((SELECT jsonb_agg(s.name ORDER BY ps."createdAt" ASC) FROM public.property_services ps JOIN public.service_catalog s ON s.id = ps."serviceId" WHERE ps."propertyId" = p.id), '[]'::jsonb) AS services,
    COALESCE((SELECT jsonb_agg(a.name ORDER BY pa."createdAt" ASC) FROM public.property_amenities pa JOIN public.amenity_catalog a ON a.id = pa."amenityId" WHERE pa."propertyId" = p.id), '[]'::jsonb) AS amenities
  FROM public.properties p
  JOIN public.users u ON u.id = p."landlordId"
`;

function catalogQuery(filters: CatalogPropertyFilters) {
  const values: unknown[] = [];
  const clauses = ["p.status = 'DISPONIBLE'::\"PropertyStatus\"", "p.approved = true"];
  if (filters.minPrice !== null) {
    values.push(filters.minPrice);
    clauses.push(`p."monthlyRent" >= $${values.length}`);
  }
  if (filters.maxPrice !== null) {
    values.push(filters.maxPrice);
    clauses.push(`p."monthlyRent" <= $${values.length}`);
  }
  for (const service of filters.services) {
    values.push(service);
    clauses.push(`EXISTS (SELECT 1 FROM public.property_services ps_filter JOIN public.service_catalog s_filter ON s_filter.id = ps_filter."serviceId" WHERE ps_filter."propertyId" = p.id AND s_filter.name = $${values.length})`);
  }
  return { text: `${CATALOG_PROPERTY_WITH_RELATIONS_SQL} WHERE ${clauses.join(" AND ")} ORDER BY p."createdAt" DESC`, values };
}

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

  async findOwnedPropertyForImages(propertyId: string, landlordId: string): Promise<{ id: string } | null> {
    const result = await this.executor.query<{ id: string }>(FIND_OWNED_PROPERTY_FOR_IMAGES_SQL, [propertyId, landlordId]);
    return result.rows[0] ?? null;
  }

  async listImagesForProperty(propertyId: string): Promise<PropertyImageRead[]> {
    const result = await this.executor.query<PropertyImageRead>(LIST_PROPERTY_IMAGES_SQL, [propertyId]);
    return result.rows;
  }

  async listCatalogProperties(filters: CatalogPropertyFilters): Promise<CatalogProperty[]> {
    const query = catalogQuery(filters);
    const result = await this.executor.query<CatalogProperty>(query.text, query.values);
    return result.rows;
  }
}
