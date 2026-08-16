import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { PropertiesRepository, type PropertiesSqlExecutor } from "../src/repositories/properties.repository";

const EXPECTED_TEST_PROJECT_REF = "ycerwszvzkmyisflxkpe";

async function main() {
  if (testPostgresConfig.user !== `postgres.${EXPECTED_TEST_PROJECT_REF}`) throw new Error("El usuario configurado no corresponde a manta360prueba");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("La sesion no corresponde a la base temporal");
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",role,\"updatedAt\") VALUES ($1,$2,$3,$4,'ARRENDADOR',CURRENT_TIMESTAMP)",
      ["catalog-landlord", "catalog-landlord@example.test", "hash-not-public", "Catalog Owner"],
    );
    await client.query(
      "INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",bedrooms,bathrooms,description,latitude,longitude,status,approved,\"updatedAt\",\"createdAt\") VALUES ($1,$2,'Disponible nueva','Manta',$3,2,1,'Descripcion',$4,$5,'DISPONIBLE',true,CURRENT_TIMESTAMP,'2026-01-05'),($6,$2,'Disponible antigua','Manta',$7,NULL,NULL,NULL,NULL,NULL,'DISPONIBLE',true,CURRENT_TIMESTAMP,'2026-01-02'),($8,$2,'No aprobada','Manta',$7,NULL,NULL,NULL,NULL,NULL,'DISPONIBLE',false,CURRENT_TIMESTAMP,'2026-01-06'),($9,$2,'Ocupada','Manta',$7,NULL,NULL,NULL,NULL,NULL,'OCUPADO',true,CURRENT_TIMESTAMP,'2026-01-07'),($10,$2,'Mantenimiento','Manta',$7,NULL,NULL,NULL,NULL,NULL,'MANTENIMIENTO',true,CURRENT_TIMESTAMP,'2026-01-08'),($11,$2,'Inhabilitada','Manta',$7,NULL,NULL,NULL,NULL,NULL,'INHABILITADO',true,CURRENT_TIMESTAMP,'2026-01-09')",
      ["catalog-new", "catalog-landlord", "200.25", "-0.95", "-80.7", "catalog-old", "100.00", "catalog-unapproved", "catalog-occupied", "catalog-maintenance", "catalog-disabled"],
    );
    await client.query(
      "INSERT INTO public.property_images (\"propertyId\",\"storagePath\",\"originalName\",extension,\"mimeType\",\"fileSize\",sha256,\"isPrimary\",\"displayOrder\",\"createdAt\",\"updatedAt\") VALUES ($1,$2,$3,'jpg','image/jpeg',1,$4,false,2,'2026-01-01',CURRENT_TIMESTAMP),($1,$5,$6,'jpg','image/jpeg',1,$7,true,1,'2026-01-02',CURRENT_TIMESTAMP)",
      ["catalog-new", "properties/catalog-secondary.jpg", "secondary.jpg", "e".repeat(64), "properties/catalog-primary.jpg", "primary.jpg", "f".repeat(64)],
    );
    const service = await client.query<{ id: string }>("INSERT INTO public.service_catalog (name,slug) VALUES ('Agua catalogo','agua-catalogo') RETURNING id");
    const amenity = await client.query<{ id: string }>("INSERT INTO public.amenity_catalog (name,slug) VALUES ('Parqueo catalogo','parqueo-catalogo') RETURNING id");
    await client.query("INSERT INTO public.property_services (\"propertyId\",\"serviceId\") VALUES ($1,$2)", ["catalog-new", service.rows[0]!.id]);
    await client.query("INSERT INTO public.property_amenities (\"propertyId\",\"amenityId\") VALUES ($1,$2)", ["catalog-new", amenity.rows[0]!.id]);

    const repository = new PropertiesRepository(client as unknown as PropertiesSqlExecutor);
    const catalog = await repository.listCatalogProperties({ minPrice: null, maxPrice: null, services: [] });
    if (catalog.map((property) => property.id).join("|") !== "catalog-new|catalog-old") throw new Error("La visibilidad o el orden del catalogo no coincide");
    const current = catalog[0]!;
    if (current.monthlyRent !== "200.25" || current.status !== "DISPONIBLE" || current.landlord.fullName !== "Catalog Owner") throw new Error("Decimal, estado o landlord no coinciden");
    if (current.images.map((image) => image.storagePath).join("|") !== "properties/catalog-primary.jpg|properties/catalog-secondary.jpg") throw new Error("El orden de imagenes no coincide");
    if (current.services.join("|") !== "Agua catalogo" || current.amenities.join("|") !== "Parqueo catalogo") throw new Error("Servicios o amenities no coinciden");
    if (JSON.stringify(current).includes("passwordHash") || JSON.stringify(current).includes("nationalId")) throw new Error("El catalogo expuso datos privados");
    const filtered = await repository.listCatalogProperties({ minPrice: 150, maxPrice: 300, services: ["Agua catalogo"] });
    if (filtered.map((property) => property.id).join("|") !== "catalog-new") throw new Error("Los filtros existentes no coinciden");
    if ((await repository.listCatalogProperties({ minPrice: null, maxPrice: null, services: ["No existe"] })).length !== 0) throw new Error("El filtro de servicios no respeta AND exacto");

    await client.query("ROLLBACK");
    console.log("POSTGRES PROPERTIES CATALOG INTEGRATION: OK");
    console.log("visibility_and_order: OK");
    console.log("filters_relations_and_decimal: OK");
    console.log("sensitive_fields: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Properties catalog integration failed");
    process.exitCode = 1;
  })
  .finally(async () => { await postgres.end(); });
