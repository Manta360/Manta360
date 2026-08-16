import "dotenv/config";
import type { PoolClient } from "pg";
import { postgres, testPostgresConfig } from "../src/lib/postgres";

const EXPECTED_TEST_PROJECT_REF = "ycerwszvzkmyisflxkpe";

function assertTemporaryProject() {
  if (testPostgresConfig.user !== `postgres.${EXPECTED_TEST_PROJECT_REF}`) {
    throw new Error("El usuario configurado no corresponde a la base temporal manta360prueba");
  }
}

async function expectRejected(client: PoolClient, statement: string, values: unknown[], expectedCode: string) {
  await client.query("SAVEPOINT constraint_test");
  try {
    await client.query(statement, values);
  } catch (error: unknown) {
    await client.query("ROLLBACK TO SAVEPOINT constraint_test");
    await client.query("RELEASE SAVEPOINT constraint_test");
    if (typeof error === "object" && error !== null && "code" in error && error.code === expectedCode) return;
    throw error;
  }
  await client.query("RELEASE SAVEPOINT constraint_test");
  throw new Error(`La operación debía fallar con ${expectedCode}`);
}

async function main() {
  assertTemporaryProject();
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") {
      throw new Error("La sesión activa no coincide con la base temporal configurada");
    }

    await client.query("BEGIN");
    await client.query("INSERT INTO public.users (id, email, \"passwordHash\", \"fullName\", role, \"updatedAt\") VALUES ($1, $2, $3, $4, 'ARRENDADOR', CURRENT_TIMESTAMP), ($5, $6, $3, $7, 'ARRENDATARIO', CURRENT_TIMESTAMP)", ["constraint-landlord", "constraint-landlord@example.test", "hash", "Landlord", "constraint-tenant", "constraint-tenant@example.test", "Tenant"]);
    await client.query("INSERT INTO public.properties (id, \"landlordId\", title, address, \"monthlyRent\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)", ["constraint-property", "constraint-landlord", "Property", "Address", 100]);

    await expectRejected(client, "INSERT INTO public.contracts (id, \"propertyId\", \"tenantId\", \"landlordId\", \"startDate\", \"endDate\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)", ["invalid-dates", "constraint-property", "constraint-tenant", "constraint-landlord", "2026-01-02", "2026-01-02"], "23514");

    await client.query("INSERT INTO public.contracts (id, \"propertyId\", \"tenantId\", \"landlordId\", \"startDate\", \"endDate\", status, \"updatedAt\") VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', CURRENT_TIMESTAMP)", ["effective-contract", "constraint-property", "constraint-tenant", "constraint-landlord", "2026-01-01", "2026-12-31"]);
    await expectRejected(client, "INSERT INTO public.contracts (id, \"propertyId\", \"tenantId\", \"landlordId\", \"startDate\", \"endDate\", status, \"updatedAt\") VALUES ($1, $2, $3, $4, $5, $6, 'EN_RENOVACION', CURRENT_TIMESTAMP)", ["duplicate-effective-contract", "constraint-property", "constraint-tenant", "constraint-landlord", "2027-01-01", "2027-12-31"], "23505");

    await expectRejected(client, "INSERT INTO public.contract_requests (id, \"propertyId\", \"tenantId\", \"updatedAt\") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)", ["invalid-foreign-key", "missing-property", "constraint-tenant"], "23503");
    await client.query("ROLLBACK");

    console.log("POSTGRES CONSTRAINT TESTS: OK");
    console.log("invalid_end_date: rejected");
    console.log("duplicate_effective_contract: rejected");
    console.log("invalid_foreign_key: rejected");
    console.log("persistent_test_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Constraint test failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.end();
  });
