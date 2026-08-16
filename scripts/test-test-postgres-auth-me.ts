import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { SessionUserRepository, type SessionUserSqlExecutor } from "../src/repositories/session-user.repository";

const EXPECTED_TEST_PROJECT_REF = "ycerwszvzkmyisflxkpe";

async function main() {
  if (testPostgresConfig.user !== `postgres.${EXPECTED_TEST_PROJECT_REF}`) throw new Error("El usuario configurado no corresponde a manta360prueba");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("La sesión no corresponde a la base temporal");

    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",phone,\"nationalId\",role,active,\"createdAt\",\"updatedAt\") VALUES ($1,$2,$3,$4,NULL,NULL,'MUNICIPIO',true,'2026-01-01',CURRENT_TIMESTAMP),($5,$6,$3,$7,$8,$9,'ARRENDADOR',true,'2026-01-02',CURRENT_TIMESTAMP),($10,$11,$3,$12,NULL,NULL,'ARRENDATARIO',true,'2026-01-03',CURRENT_TIMESTAMP),($13,$14,$3,$15,NULL,NULL,'ARRENDATARIO',false,'2026-01-04',CURRENT_TIMESTAMP)",
      ["auth-me-municipio", "municipio@example.test", "hash-not-exposed", "Municipio", "auth-me-landlord", "landlord@example.test", "Landlord", "0999999999", "1111111111", "auth-me-tenant", "tenant@example.test", "Tenant", "auth-me-inactive", "inactive@example.test", "Inactive"],
    );

    const repository = new SessionUserRepository(client as unknown as SessionUserSqlExecutor);
    for (const [id, role] of [["auth-me-municipio", "MUNICIPIO"], ["auth-me-landlord", "ARRENDADOR"], ["auth-me-tenant", "ARRENDATARIO"]] as const) {
      const user = await repository.findPublicSessionUserById(id);
      if (!user || user.role !== role || !user.active || !(user.createdAt instanceof Date)) throw new Error(`La proyección pública de ${role} no coincide`);
      if (JSON.stringify(user).includes("passwordHash")) throw new Error("La consulta expuso passwordHash");
    }
    const inactive = await repository.findPublicSessionUserById("auth-me-inactive");
    if (!inactive || inactive.active !== false) throw new Error("El usuario inactivo no conserva su estado");
    if (await repository.findPublicSessionUserById("missing")) throw new Error("Un usuario inexistente fue encontrado");

    await client.query("ROLLBACK");
    console.log("POSTGRES AUTH ME INTEGRATION: OK");
    console.log("roles_active_inactive_dates_nulls: OK");
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
    console.error(error instanceof Error ? error.message : "Auth me integration failed");
    process.exitCode = 1;
  })
  .finally(async () => { await postgres.end(); });
