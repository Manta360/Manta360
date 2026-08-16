import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { SessionUserRepository, type SessionUserSqlExecutor } from "../src/repositories/session-user.repository";

const PROJECT = "ycerwszvzkmyisflxkpe";

async function main() {
  if (testPostgresConfig.user !== `postgres.${PROJECT}`) throw new Error("Destino temporal no confirmado");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("Sesion fuera de manta360prueba");

    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",role,active,\"updatedAt\") VALUES ('session-user-municipio','session-user-municipio@test','hash-m','Municipio','MUNICIPIO',true,CURRENT_TIMESTAMP),('session-user-landlord','session-user-landlord@test','hash-l','Arrendador','ARRENDADOR',true,CURRENT_TIMESTAMP),('session-user-tenant','session-user-tenant@test','hash-t','Arrendatario','ARRENDATARIO',true,CURRENT_TIMESTAMP),('session-user-inactive','session-user-inactive@test','hash-i','Inactivo','ARRENDATARIO',false,CURRENT_TIMESTAMP)",
    );

    const repository = new SessionUserRepository(client as unknown as SessionUserSqlExecutor);
    const municipio = await repository.findActiveSessionUserById("session-user-municipio");
    const landlord = await repository.findActiveSessionUserById("session-user-landlord");
    const tenant = await repository.findActiveSessionUserById("session-user-tenant");
    const inactive = await repository.findActiveSessionUserById("session-user-inactive");
    const missing = await repository.findActiveSessionUserById("session-user-missing");

    if (!municipio?.active || !landlord?.active || !tenant?.active || inactive?.active !== false || missing !== null) {
      throw new Error("Semantica de usuario activo, inactivo o inexistente incorrecta");
    }
    if (JSON.stringify([municipio, landlord, tenant, inactive]).includes("passwordHash")) throw new Error("Campo sensible expuesto");

    await client.query("ROLLBACK");
    console.log("POSTGRES SESSION USER INTEGRATION: OK");
    console.log("active_inactive_missing_projection: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Session user integration failed");
  process.exitCode = 1;
}).finally(async () => {
  await postgres.end();
});
