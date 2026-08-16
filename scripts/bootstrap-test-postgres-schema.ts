import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgres, queryPostgres, testPostgresConfig } from "../src/lib/postgres";

const EXPECTED_TEST_PROJECT_REF = "ycerwszvzkmyisflxkpe";
const EXPECTED_TABLES = [
  "amenity_catalog", "chat_messages", "contract_renewal_requests", "contract_requests", "contracts", "identity_document_reviews", "identity_documents", "incident_reports", "properties", "property_amenities", "property_images", "property_services", "service_catalog", "users",
] as const;

function assertTemporaryProject() {
  if (testPostgresConfig.user !== `postgres.${EXPECTED_TEST_PROJECT_REF}`) {
    throw new Error("El usuario configurado no corresponde a la base temporal manta360prueba");
  }
}

async function main() {
  assertTemporaryProject();
  const context = await queryPostgres<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
  if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") {
    throw new Error("La sesión activa no coincide con la base temporal configurada");
  }

  const currentTables = await queryPostgres<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name");
  const unexpected = currentTables.rows.map(({ table_name }) => table_name).filter((table) => !EXPECTED_TABLES.includes(table as (typeof EXPECTED_TABLES)[number]));
  if (unexpected.length > 0) {
    throw new Error("La base temporal contiene tablas no reconocidas; el bootstrap no realizará cambios");
  }

  const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../database/schema.sql");
  const schema = await readFile(schemaPath, "utf8");
  await postgres.query(schema);
  console.log("POSTGRES SCHEMA BOOTSTRAP: OK");
  console.log("target: manta360prueba (confirmed)");
  console.log(`tables: ${EXPECTED_TABLES.length}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Schema bootstrap failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.end();
  });
