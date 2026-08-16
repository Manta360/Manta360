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
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",role,\"updatedAt\") VALUES ($1,$2,$3,$4,'ARRENDADOR',CURRENT_TIMESTAMP),($5,$6,$3,$7,'ARRENDADOR',CURRENT_TIMESTAMP)",
      ["detail-landlord-a", "detail-landlord-a@example.test", "hash-not-exposed", "A", "detail-landlord-b", "detail-landlord-b@example.test", "B"],
    );
    await client.query(
      "INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",bedrooms,bathrooms,description,latitude,longitude,status,approved,\"updatedAt\",\"createdAt\") VALUES ($1,$2,$3,$4,$5,2,1,$6,$7,$8,'INHABILITADO',false,CURRENT_TIMESTAMP,'2026-01-03'),($9,$2,$10,$4,$11,NULL,NULL,NULL,NULL,NULL,'DISPONIBLE',true,CURRENT_TIMESTAMP,'2026-01-04'),($12,$13,$14,$4,$11,1,1,NULL,NULL,NULL,'DISPONIBLE',true,CURRENT_TIMESTAMP,'2026-01-05')",
      ["detail-a", "detail-landlord-a", "A", "Manta", "200.25", "Descripcion", "-0.95", "-80.7", "detail-a-empty", "Empty", "100.00", "detail-b", "detail-landlord-b", "B"],
    );
    await client.query(
      "INSERT INTO public.property_images (\"propertyId\",\"storagePath\",\"originalName\",extension,\"mimeType\",\"fileSize\",sha256,\"isPrimary\",\"displayOrder\",\"createdAt\",\"updatedAt\") VALUES ($1,$2,$3,'jpg','image/jpeg',1,$4,false,2,'2026-01-01',CURRENT_TIMESTAMP),($1,$5,$6,'jpg','image/jpeg',1,$7,true,1,'2026-01-02',CURRENT_TIMESTAMP)",
      ["detail-a", "properties/detail-secondary.jpg", "secondary.jpg", "c".repeat(64), "properties/detail-primary.jpg", "primary.jpg", "d".repeat(64)],
    );
    const service = await client.query<{ id: string }>("INSERT INTO public.service_catalog (name,slug) VALUES ('Agua detalle','agua-detalle') RETURNING id");
    const amenity = await client.query<{ id: string }>("INSERT INTO public.amenity_catalog (name,slug) VALUES ('Parqueo detalle','parqueo-detalle') RETURNING id");
    await client.query("INSERT INTO public.property_services (\"propertyId\",\"serviceId\") VALUES ($1,$2)", ["detail-a", service.rows[0]!.id]);
    await client.query("INSERT INTO public.property_amenities (\"propertyId\",\"amenityId\") VALUES ($1,$2)", ["detail-a", amenity.rows[0]!.id]);

    const repository = new PropertiesRepository(client as unknown as PropertiesSqlExecutor);
    const detail = await repository.findMineById("detail-a", "detail-landlord-a");
    if (!detail) throw new Error("No se encontro la propiedad propia");
    if (detail.status !== "INHABILITADO" || detail.approved !== false || detail.monthlyRent !== "200.25") throw new Error("Status, approved o decimal no coinciden");
    if (detail.images.map((image) => image.storagePath).join("|") !== "properties/detail-primary.jpg|properties/detail-secondary.jpg") throw new Error("El orden de imagenes no coincide");
    if (detail.services.join("|") !== "Agua detalle" || detail.amenities.join("|") !== "Parqueo detalle") throw new Error("Las relaciones no coinciden");
    if (JSON.stringify(detail).includes("passwordHash")) throw new Error("La consulta expuso passwordHash");
    const empty = await repository.findMineById("detail-a-empty", "detail-landlord-a");
    if (!empty || empty.images.length !== 0 || empty.services.length !== 0 || empty.amenities.length !== 0) throw new Error("Los arrays vacios no se preservaron");
    if (await repository.findMineById("detail-a", "detail-landlord-b")) throw new Error("Landlord B pudo leer una propiedad ajena");
    if (await repository.findMineById("missing", "detail-landlord-a")) throw new Error("Un id inexistente devolvio una propiedad");

    await client.query("ROLLBACK");
    console.log("POSTGRES PROPERTY DETAIL INTEGRATION: OK");
    console.log("ownership_status_relations: OK");
    console.log("decimal_nulls_images: OK");
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
    console.error(error instanceof Error ? error.message : "Property detail integration failed");
    process.exitCode = 1;
  })
  .finally(async () => { await postgres.end(); });
