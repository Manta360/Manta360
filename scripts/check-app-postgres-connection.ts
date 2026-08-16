import "dotenv/config";
import { randomUUID } from "node:crypto";
import { applicationPostgres, appPostgresConfig } from "../src/lib/postgres-app";

async function main() {
  const client = await applicationPostgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("La conexión de aplicación no corresponde a manta360prueba");
    await client.query("BEGIN");
    await client.query('INSERT INTO public.users (id,email,"passwordHash","fullName",role,"updatedAt") VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)', [`app-check-${randomUUID()}`, `app-check-${randomUUID()}@example.test`, "not-a-real-password", "Application check", "ARRENDATARIO"]);
    await client.query("ROLLBACK");
    console.log("APP POSTGRES CONNECTION: OK");
    console.log(`project_ref: ${process.env.PG_APP_PROJECT_REF}`);
    console.log(`host: ${appPostgresConfig.host.slice(0, 4)}…${appPostgresConfig.host.slice(-19)}`);
    console.log("database: postgres");
    console.log("current_user: postgres.[redactado]");
    console.log("transactional_insert_rollback: OK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch(() => { console.error("APP POSTGRES CONNECTION: ERROR (no secrets logged)"); process.exitCode = 1; }).finally(async () => { await applicationPostgres.end(); });
