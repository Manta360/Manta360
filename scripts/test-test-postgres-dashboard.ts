import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { DashboardRepository, type DashboardSqlExecutor } from "../src/repositories/dashboard.repository";

const EXPECTED_TEST_PROJECT_REF = "ycerwszvzkmyisflxkpe";

function assertTemporaryProject() {
  if (testPostgresConfig.user !== `postgres.${EXPECTED_TEST_PROJECT_REF}`) {
    throw new Error("El usuario configurado no corresponde a la base temporal manta360prueba");
  }
}

async function main() {
  assertTemporaryProject();
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("La sesión activa no coincide con la base temporal configurada");

    await client.query("BEGIN");
    await client.query("INSERT INTO public.users (id, email, \"passwordHash\", \"fullName\", role, \"updatedAt\") VALUES ($1, $2, $3, $4, 'ARRENDADOR', CURRENT_TIMESTAMP), ($5, $6, $3, $7, 'ARRENDATARIO', CURRENT_TIMESTAMP), ($8, $9, $3, $10, 'ARRENDATARIO', CURRENT_TIMESTAMP), ($11, $12, $3, $13, 'MUNICIPIO', CURRENT_TIMESTAMP)", ["dashboard-landlord", "dashboard-landlord@example.test", "hash", "Landlord", "dashboard-tenant", "dashboard-tenant@example.test", "Tenant", "dashboard-empty", "dashboard-empty@example.test", "Empty", "dashboard-municipio", "dashboard-municipio@example.test", "Municipio"]);
    await client.query("INSERT INTO public.properties (id, \"landlordId\", title, address, \"monthlyRent\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)", ["dashboard-property", "dashboard-landlord", "Property", "Address", 100]);
    await client.query("INSERT INTO public.contract_requests (id, \"propertyId\", \"tenantId\", \"updatedAt\") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)", ["dashboard-request", "dashboard-property", "dashboard-tenant"]);
    await client.query("INSERT INTO public.chat_messages (id, \"propertyId\", \"senderId\", \"recipientId\", content) VALUES ($1, $2, $3, $4, $5), ($6, $2, $4, $3, $7)", ["dashboard-message-1", "dashboard-property", "dashboard-tenant", "dashboard-landlord", "Hola", "dashboard-message-2", "Respuesta"]);
    await client.query("INSERT INTO public.identity_documents (\"userId\", \"uploadedBy\", \"documentType\", side, \"storagePath\", \"originalName\", extension, \"mimeType\", \"fileSize\", sha256, \"verificationStatus\", \"isCurrent\") VALUES ($1, $1, 'CEDULA', 'FRENTE', $2, 'id.pdf', 'pdf', 'application/pdf', 10, $3, 'VERIFICADO', true), ($1, $1, 'PASAPORTE', 'UNICA', $4, 'passport.pdf', 'pdf', 'application/pdf', 10, $5, 'PENDIENTE', true), ($1, $1, 'CEDULA', 'REVERSO', $6, 'old.pdf', 'pdf', 'application/pdf', 10, $7, 'VERIFICADO', false)", ["dashboard-tenant", "identity/verified.pdf", "a".repeat(64), "identity/pending.pdf", "b".repeat(64), "identity/old.pdf", "c".repeat(64)]);

    const repository = new DashboardRepository(client as unknown as DashboardSqlExecutor);
    const emptyTenant = await repository.getTenantCounts("dashboard-empty");
    if (JSON.stringify(emptyTenant) !== JSON.stringify({ requests: 0, conversations: 0, documents: 0 })) throw new Error("Los ceros del arrendatario no se conservaron");
    const tenant = await repository.getTenantCounts("dashboard-tenant");
    if (JSON.stringify(tenant) !== JSON.stringify({ requests: 1, conversations: 2, documents: 1 })) throw new Error("Los counts del arrendatario no coinciden");
    const landlord = await repository.getLandlordCounts("dashboard-landlord");
    if (JSON.stringify(landlord) !== JSON.stringify({ properties: 1, conversations: 2, documents: 0 })) throw new Error("Los counts del arrendador no coinciden");
    if ((await repository.findUserById("dashboard-tenant"))?.phone !== null) throw new Error("Los nulls del usuario no se conservaron");
    if (await repository.findUserById("dashboard-missing")) throw new Error("Se encontró un usuario inexistente");

    await client.query("ROLLBACK");
    console.log("POSTGRES DASHBOARD INTEGRATION: OK");
    console.log("tenant_zero_counts: OK");
    console.log("tenant_counts: OK");
    console.log("landlord_counts: OK");
    console.log("user_nulls_and_missing_user: OK");
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
    console.error(error instanceof Error ? error.message : "Dashboard integration test failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.end();
  });
