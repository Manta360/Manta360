import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { PropertiesRepository, type PropertiesSqlExecutor } from "../src/repositories/properties.repository";

const EXPECTED_TEST_PROJECT_REF = "ycerwszvzkmyisflxkpe";

async function main() {
  if (testPostgresConfig.user !== `postgres.${EXPECTED_TEST_PROJECT_REF}`) throw new Error("El usuario configurado no corresponde a manta360prueba");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("La sesión no corresponde a la base temporal");
    await client.query("BEGIN");
    await client.query("INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",role,\"updatedAt\") VALUES ($1,$2,$3,$4,'ARRENDADOR',CURRENT_TIMESTAMP),($5,$6,$3,$7,'ARRENDADOR',CURRENT_TIMESTAMP)", ["mine-a", "mine-a@example.test", "hash", "A", "mine-b", "mine-b@example.test", "B"]);
    await client.query("INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",bedrooms,bathrooms,description,latitude,longitude,status,\"updatedAt\",\"createdAt\") VALUES ($1,$2,$3,$4,$5,NULL,NULL,NULL,NULL,NULL,'DISPONIBLE',CURRENT_TIMESTAMP,'2026-01-02'),($6,$2,$7,$4,$8,2,1,$9,$10,$11,'MANTENIMIENTO',CURRENT_TIMESTAMP,'2026-01-03'),($12,$13,$14,$4,$8,1,1,NULL,NULL,NULL,'INHABILITADO',CURRENT_TIMESTAMP,'2026-01-04')", ["mine-a-old", "mine-a", "Old", "Address", "100.50", "mine-a-new", "New", "200.25", "Description", "-0.95", "-80.7", "mine-b-property", "mine-b", "B property"]);
    await client.query("INSERT INTO public.property_images (\"propertyId\",\"storagePath\",\"originalName\",extension,\"mimeType\",\"fileSize\",sha256,\"isPrimary\",\"displayOrder\",\"createdAt\",\"updatedAt\") VALUES ($1,$2,$3,'jpg','image/jpeg',1,$4,false,2,'2026-01-01',CURRENT_TIMESTAMP),($1,$5,$6,'jpg','image/jpeg',1,$7,true,1,'2026-01-02',CURRENT_TIMESTAMP)", ["mine-a-new", "properties/secondary.jpg", "secondary.jpg", "a".repeat(64), "properties/primary.jpg", "primary.jpg", "b".repeat(64)]);
    const service = await client.query<{ id: string }>("INSERT INTO public.service_catalog (name,slug) VALUES ('Agua','agua') RETURNING id");
    const amenity = await client.query<{ id: string }>("INSERT INTO public.amenity_catalog (name,slug) VALUES ('Parqueo','parqueo') RETURNING id");
    await client.query("INSERT INTO public.property_services (\"propertyId\",\"serviceId\") VALUES ($1,$2)", ["mine-a-new", service.rows[0]!.id]);
    await client.query("INSERT INTO public.property_amenities (\"propertyId\",\"amenityId\") VALUES ($1,$2)", ["mine-a-new", amenity.rows[0]!.id]);
    const repository = new PropertiesRepository(client as unknown as PropertiesSqlExecutor);
    const mineA = await repository.listMineForLandlord("mine-a");
    if (mineA.map((item) => item.id).join("|") !== "mine-a-new|mine-a-old") throw new Error("El orden o ownership de propiedades no coincide");
    const newer = mineA[0]!;
    if (newer.images.map((image) => image.storagePath).join("|") !== "properties/primary.jpg|properties/secondary.jpg") throw new Error("El orden de imágenes no coincide");
    if (newer.services.join("|") !== "Agua" || newer.amenities.join("|") !== "Parqueo") throw new Error("Las relaciones no coinciden");
    if (newer.monthlyRent !== "200.25" || newer.bedrooms !== 2 || newer.description !== "Description" || newer.status !== "MANTENIMIENTO") throw new Error("Decimal, nulls o estado no coinciden");
    if ((await repository.listMineForLandlord("mine-b")).map(({ id }) => id).join("|") !== "mine-b-property") throw new Error("Landlord B no quedó aislado");
    await client.query("ROLLBACK");
    console.log("POSTGRES PROPERTIES MINE INTEGRATION: OK");
    console.log("ownership_and_order: OK"); console.log("images_services_amenities: OK"); console.log("decimal_nulls_status: OK"); console.log("persistent_fixture_data: none");
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Properties mine integration failed"); process.exitCode = 1; }).finally(async () => { await postgres.end(); });
