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
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",role,\"updatedAt\") VALUES ($1,$2,$3,$4,'ARRENDADOR',CURRENT_TIMESTAMP),($5,$6,$3,$7,'ARRENDADOR',CURRENT_TIMESTAMP)",
      ["images-landlord-a", "images-a@example.test", "hash-not-exposed", "A", "images-landlord-b", "images-b@example.test", "B"],
    );
    await client.query(
      "INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",status,\"updatedAt\") VALUES ($1,$2,$3,$4,$5,'DISPONIBLE',CURRENT_TIMESTAMP),($6,$2,$7,$4,$5,'DISPONIBLE',CURRENT_TIMESTAMP),($8,$9,$10,$4,$5,'DISPONIBLE',CURRENT_TIMESTAMP)",
      ["images-a", "images-landlord-a", "A", "Manta", "100.00", "images-a-empty", "Empty", "images-b", "images-landlord-b", "B"],
    );
    await client.query(
      "INSERT INTO public.property_images (\"propertyId\",\"storagePath\",\"originalName\",extension,\"mimeType\",\"fileSize\",sha256,\"isPrimary\",\"displayOrder\",\"createdAt\",\"updatedAt\") VALUES ($1,$2,$3,'jpg','image/jpeg',1,$4,false,2,'2026-01-01',CURRENT_TIMESTAMP),($1,$5,$6,'jpg','image/jpeg',1,$7,true,1,'2026-01-02',CURRENT_TIMESTAMP)",
      ["images-a", "properties/images-secondary.jpg", "secondary.jpg", "a".repeat(64), "properties/images-primary.jpg", "primary.jpg", "b".repeat(64)],
    );

    const repository = new PropertiesRepository(client as unknown as PropertiesSqlExecutor);
    if (!await repository.findOwnedPropertyForImages("images-a", "images-landlord-a")) throw new Error("No se encontró la propiedad propia");
    if (await repository.findOwnedPropertyForImages("images-a", "images-landlord-b")) throw new Error("El arrendador B obtuvo una propiedad ajena");
    if (await repository.findOwnedPropertyForImages("missing", "images-landlord-a")) throw new Error("Una propiedad inexistente fue encontrada");
    const images = await repository.listImagesForProperty("images-a");
    if (images.map((image) => image.storagePath).join("|") !== "properties/images-primary.jpg|properties/images-secondary.jpg") throw new Error("El orden de imágenes no coincide");
    if (JSON.stringify(images).includes("passwordHash") || JSON.stringify(images).includes("sha256")) throw new Error("La consulta expuso metadata no permitida");
    if ((await repository.listImagesForProperty("images-a-empty")).length !== 0) throw new Error("Las imágenes vacías no se preservaron");

    await client.query("ROLLBACK");
    console.log("POSTGRES PROPERTY IMAGES INTEGRATION: OK");
    console.log("ownership_order_empty_images: OK");
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
    console.error(error instanceof Error ? error.message : "Property images integration failed");
    process.exitCode = 1;
  })
  .finally(async () => { await postgres.end(); });
