import type { QueryResultRow } from "pg";

export type MineImage = { id: string; storagePath: string; isPrimary: boolean; displayOrder: number };
export type PropertyImageRead = { id: string; storagePath: string; isPrimary: boolean; displayOrder: number };
export type MineProperty = { id: string; title: string; address: string; monthlyRent: string | number; bedrooms: number | null; bathrooms: number | null; description: string | null; latitude: string | number | null; longitude: string | number | null; status: string; approved: boolean; disableReason: string | null; createdAt: Date; updatedAt: Date; images: MineImage[]; services: string[]; amenities: string[] };
export type CatalogProperty = { id: string; title: string; address: string; monthlyRent: string | number; status: string; description: string | null; bedrooms: number | null; bathrooms: number | null; latitude: string | number | null; longitude: string | number | null; landlord: { id: string; fullName: string }; createdAt: Date; updatedAt: Date; images: MineImage[]; services: string[]; amenities: string[] };
export type CatalogPropertyFilters = {
  location: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  services: string[];
};
export type PropertiesSqlResult<Row> = { rows: Row[] };
export interface PropertiesSqlExecutor { query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<PropertiesSqlResult<Row>>; }
export type PropertyWriteInput = {
  id: string; landlordId: string; title: string; address: string; monthlyRent: number; description: string | null;
  bedrooms: number | null; bathrooms: number | null; latitude: number | null; longitude: number | null;
};
export type PropertyImageWriteInput = {
  propertyId: string; storagePath: string; originalName: string; extension: string; mimeType: string;
  fileSize: number; sha256: string; isPrimary: boolean; displayOrder: number;
};
export type OwnedEditableProperty = { id: string; status: string };
export type PropertyImageWrite = { id: string; storagePath: string; isPrimary: boolean; displayOrder: number; sha256: string };
export type PropertyUpdateInput = Partial<Pick<PropertyWriteInput, "title" | "address" | "monthlyRent" | "description" | "bedrooms" | "bathrooms" | "latitude" | "longitude">>;

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

const FIND_PROPERTY_FOR_RESPONSE_SQL = `
  ${CATALOG_PROPERTY_WITH_RELATIONS_SQL}
  WHERE p.id = $1
  LIMIT 1
`;

function catalogQuery(filters: CatalogPropertyFilters) {
  const values: unknown[] = [];
  const clauses = [
    "p.status = 'DISPONIBLE'::\"PropertyStatus\"",
    "p.approved = true",
    "u.active = true",
  ];
  if (filters.location) {
    values.push(filters.location);
    clauses.push(`p.address ILIKE '%' || $${values.length} || '%'`);
  }
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

  async listVerifiedIdentityDocuments(userId: string): Promise<Array<{ documentType: string; side: string }>> {
    const result = await this.executor.query<{ documentType: string; side: string }>(
      'SELECT "documentType", side FROM public.identity_documents WHERE "userId" = $1 AND "isCurrent" = true AND "verificationStatus" = \'VERIFICADO\'::"IdentityDocumentStatus"',
      [userId],
    );
    return result.rows;
  }

  async upsertCatalogEntries(names: string[], kind: "service" | "amenity"): Promise<string[]> {
    const table = kind === "service" ? "service_catalog" : "amenity_catalog";
    const ids: string[] = [];
    for (const [index, name] of names.entries()) {
      const slug = `${name.toLocaleLowerCase("es-EC").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || kind}-${Date.now().toString(36)}-${index}`.slice(0, 120);
      const result = await this.executor.query<{ id: string }>(
        `INSERT INTO public.${table} (name, slug, active, "updatedAt") VALUES ($1, $2, true, CURRENT_TIMESTAMP) ON CONFLICT (name) DO UPDATE SET active = true, "updatedAt" = CURRENT_TIMESTAMP RETURNING id`,
        [name, slug],
      );
      ids.push(result.rows[0]!.id);
    }
    return ids;
  }

  async createProperty(input: PropertyWriteInput, serviceIds: string[], amenityIds: string[]): Promise<void> {
    await this.executor.query(
      'INSERT INTO public.properties (id,"landlordId",title,address,"monthlyRent",description,bedrooms,bathrooms,latitude,longitude,status,"createdBy","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,\'DISPONIBLE\'::"PropertyStatus",$2,CURRENT_TIMESTAMP)',
      [input.id, input.landlordId, input.title, input.address, input.monthlyRent, input.description, input.bedrooms, input.bathrooms, input.latitude, input.longitude],
    );
    for (const id of serviceIds) await this.executor.query('INSERT INTO public.property_services ("propertyId","serviceId") VALUES ($1,$2)', [input.id, id]);
    for (const id of amenityIds) await this.executor.query('INSERT INTO public.property_amenities ("propertyId","amenityId") VALUES ($1,$2)', [input.id, id]);
  }

  async createImage(input: PropertyImageWriteInput): Promise<PropertyImageWrite> {
    const result = await this.executor.query<PropertyImageWrite>(
      'INSERT INTO public.property_images ("propertyId","storagePath","originalName",extension,"mimeType","fileSize",sha256,"isPrimary","displayOrder","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP) RETURNING id,"storagePath","isPrimary","displayOrder",sha256',
      [input.propertyId, input.storagePath, input.originalName, input.extension, input.mimeType, input.fileSize, input.sha256, input.isPrimary, input.displayOrder],
    );
    return result.rows[0]!;
  }

  async findForResponse(propertyId: string): Promise<CatalogProperty | null> {
    const result = await this.executor.query<CatalogProperty>(FIND_PROPERTY_FOR_RESPONSE_SQL, [propertyId]);
    return result.rows[0] ?? null;
  }

  async findOwnedEditable(propertyId: string, landlordId: string): Promise<OwnedEditableProperty | null> {
    const result = await this.executor.query<OwnedEditableProperty>('SELECT id,status FROM public.properties WHERE id = $1 AND "landlordId" = $2 LIMIT 1', [propertyId, landlordId]);
    return result.rows[0] ?? null;
  }

  async imageCountAndHashes(propertyId: string): Promise<{ count: number; hashes: string[] }> {
    const result = await this.executor.query<{ count: string | number; hashes: string[] }>('SELECT count(*) AS count, COALESCE(array_agg(sha256), ARRAY[]::text[]) AS hashes FROM public.property_images WHERE "propertyId" = $1', [propertyId]);
    return { count: Number(result.rows[0]?.count ?? 0), hashes: result.rows[0]?.hashes ?? [] };
  }

  async deleteProperty(propertyId: string): Promise<void> {
    await this.executor.query('DELETE FROM public.properties WHERE id = $1', [propertyId]);
  }

  async findOwnedImage(imageId: string, propertyId: string, landlordId: string): Promise<PropertyImageWrite | null> {
    const result = await this.executor.query<PropertyImageWrite>(
      'SELECT i.id,i."storagePath",i."isPrimary",i."displayOrder",i.sha256 FROM public.property_images i JOIN public.properties p ON p.id = i."propertyId" WHERE i.id = $1 AND i."propertyId" = $2 AND p."landlordId" = $3 LIMIT 1',
      [imageId, propertyId, landlordId],
    );
    return result.rows[0] ?? null;
  }

  async updateImage(imageId: string, propertyId: string, isPrimary: boolean | undefined, displayOrder: number | undefined): Promise<PropertyImageWrite> {
    if (isPrimary === true) await this.executor.query('UPDATE public.property_images SET "isPrimary" = false,"updatedAt" = CURRENT_TIMESTAMP WHERE "propertyId" = $1', [propertyId]);
    const result = await this.executor.query<PropertyImageWrite>(
      'UPDATE public.property_images SET "isPrimary" = COALESCE($2,"isPrimary"), "displayOrder" = COALESCE($3,"displayOrder"), "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id,"storagePath","isPrimary","displayOrder",sha256',
      [imageId, isPrimary, displayOrder],
    );
    return result.rows[0]!;
  }

  async deleteImageAndPromote(image: PropertyImageWrite, propertyId: string): Promise<void> {
    if (image.isPrimary) {
      await this.executor.query(
        'UPDATE public.property_images SET "isPrimary" = true,"updatedAt" = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM public.property_images WHERE "propertyId" = $1 AND id <> $2 ORDER BY "displayOrder" ASC,"createdAt" ASC LIMIT 1)',
        [propertyId, image.id],
      );
    }
    await this.executor.query('DELETE FROM public.property_images WHERE id = $1 AND "propertyId" = $2', [image.id, propertyId]);
  }

  async countEffectiveContracts(propertyId: string): Promise<number> {
    const result = await this.executor.query<{ count: string | number }>('SELECT count(*) AS count FROM public.contracts WHERE "propertyId" = $1 AND status IN (\'ACTIVO\',\'EN_RENOVACION\')', [propertyId]);
    return Number(result.rows[0]?.count ?? 0);
  }

  async changeLandlordStatus(propertyId: string, landlordId: string, status: "DISPONIBLE" | "MANTENIMIENTO"): Promise<boolean> {
    const current = await this.executor.query<OwnedEditableProperty>('SELECT id,status FROM public.properties WHERE id = $1 AND "landlordId" = $2 FOR UPDATE', [propertyId, landlordId]);
    const property = current.rows[0];
    if (!property || !["DISPONIBLE", "MANTENIMIENTO"].includes(property.status) || property.status === status) return false;
    if (await this.countEffectiveContracts(propertyId)) return false;
    const result = await this.executor.query<{ id: string }>('UPDATE public.properties SET status = $2::"PropertyStatus","updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id', [propertyId, status]);
    return result.rows.length === 1;
  }

  async updateOwnedProperty(propertyId: string, landlordId: string, fields: PropertyUpdateInput, services: string[] | undefined, amenities: string[] | undefined): Promise<boolean> {
    const sets: string[] = ['"updatedAt" = CURRENT_TIMESTAMP'];
    const values: unknown[] = [propertyId, landlordId];
    const fieldMap: Array<[keyof PropertyUpdateInput, string]> = [["title", "title"], ["address", "address"], ["monthlyRent", "monthlyRent"], ["bedrooms", "bedrooms"], ["bathrooms", "bathrooms"], ["description", "description"], ["latitude", "latitude"], ["longitude", "longitude"]];
    for (const [key, column] of fieldMap) {
      if (fields[key] === undefined) continue;
      values.push(fields[key]);
      sets.push(`"${column}" = $${values.length}`);
    }
    const updated = await this.executor.query<{ id: string }>(`UPDATE public.properties SET ${sets.join(", ")} WHERE id = $1 AND "landlordId" = $2 RETURNING id`, values);
    if (!updated.rows[0]) return false;
    if (services !== undefined) {
      const ids = await this.upsertCatalogEntries(services, "service");
      await this.executor.query('DELETE FROM public.property_services WHERE "propertyId" = $1', [propertyId]);
      for (const id of ids) await this.executor.query('INSERT INTO public.property_services ("propertyId","serviceId") VALUES ($1,$2)', [propertyId, id]);
    }
    if (amenities !== undefined) {
      const ids = await this.upsertCatalogEntries(amenities, "amenity");
      await this.executor.query('DELETE FROM public.property_amenities WHERE "propertyId" = $1', [propertyId]);
      for (const id of ids) await this.executor.query('INSERT INTO public.property_amenities ("propertyId","amenityId") VALUES ($1,$2)', [propertyId, id]);
    }
    return true;
  }

  async findOwnedForDeletion(propertyId: string, landlordId: string): Promise<{ id: string; status: string; images: Array<{ storagePath: string }> } | null> {
    const result = await this.executor.query<{ id: string; status: string; images: Array<{ storagePath: string }> }>(
      'SELECT p.id,p.status,COALESCE((SELECT jsonb_agg(jsonb_build_object(\'storagePath\',i."storagePath")) FROM public.property_images i WHERE i."propertyId" = p.id),\'[]\'::jsonb) AS images FROM public.properties p WHERE p.id = $1 AND p."landlordId" = $2 LIMIT 1',
      [propertyId, landlordId],
    );
    return result.rows[0] ?? null;
  }

  async relatedHistoryCounts(propertyId: string): Promise<{ activeContracts: number; contracts: number; requests: number; incidents: number; messages: number }> {
    const result = await this.executor.query<{ activeContracts: string | number; contracts: string | number; requests: string | number; incidents: string | number; messages: string | number }>(
      'SELECT (SELECT count(*) FROM public.contracts WHERE "propertyId" = $1 AND status IN (\'ACTIVO\',\'EN_RENOVACION\')) AS "activeContracts",(SELECT count(*) FROM public.contracts WHERE "propertyId" = $1) AS contracts,(SELECT count(*) FROM public.contract_requests WHERE "propertyId" = $1) AS requests,(SELECT count(*) FROM public.incident_reports WHERE "propertyId" = $1) AS incidents,(SELECT count(*) FROM public.chat_messages WHERE "propertyId" = $1) AS messages',
      [propertyId],
    );
    const row = result.rows[0]!;
    return { activeContracts: Number(row.activeContracts), contracts: Number(row.contracts), requests: Number(row.requests), incidents: Number(row.incidents), messages: Number(row.messages) };
  }
}
