import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { ContractRequestsRepository, type ContractRequestsSqlExecutor } from "../src/repositories/contract-requests.repository";

const PROJECT = "ycerwszvzkmyisflxkpe";

async function main() {
  if (testPostgresConfig.user !== `postgres.${PROJECT}`) throw new Error("Destino temporal no confirmado");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("Sesion fuera de manta360prueba");
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",phone,\"nationalId\",role,\"updatedAt\") VALUES ($1,$2,$3,$4,$5,$6,'ARRENDATARIO',CURRENT_TIMESTAMP),($7,$8,$3,$9,$10,$11,'ARRENDATARIO',CURRENT_TIMESTAMP),($12,$13,$3,$14,NULL,NULL,'ARRENDADOR',CURRENT_TIMESTAMP),($15,$16,$3,$17,NULL,NULL,'ARRENDADOR',CURRENT_TIMESTAMP)",
      ["request-tenant-a", "request-tenant-a@test", "hash", "Tenant A", "111", "a-id", "request-tenant-b", "request-tenant-b@test", "Tenant B", "222", "b-id", "request-landlord-a", "request-landlord-a@test", "Landlord A", "request-landlord-b", "request-landlord-b@test", "Landlord B"],
    );
    await client.query(
      "INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",\"updatedAt\") VALUES ('request-property-a','request-landlord-a','Property A','Manta A',500,CURRENT_TIMESTAMP),('request-property-b','request-landlord-b','Property B','Manta B',600,CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.contract_requests (id,\"propertyId\",\"tenantId\",status,message,\"startDate\",\"endDate\",\"createdAt\",\"updatedAt\") VALUES ('request-pending','request-property-a','request-tenant-a','PENDIENTE','Pending','2026-01-01','2026-02-01','2026-01-03',CURRENT_TIMESTAMP),('request-approved','request-property-a','request-tenant-a','APROBADO',NULL,NULL,NULL,'2026-01-02',CURRENT_TIMESTAMP),('request-rejected','request-property-b','request-tenant-b','RECHAZADO','Rejected','2026-03-01','2026-04-01','2026-01-01',CURRENT_TIMESTAMP)",
    );

    const repository = new ContractRequestsRepository(client as unknown as ContractRequestsSqlExecutor);
    const tenantA = await repository.listForSession("ARRENDATARIO", "request-tenant-a");
    const landlordA = await repository.listForSession("ARRENDADOR", "request-landlord-a");
    const municipality = await repository.listForSession("MUNICIPIO", "request-municipio");
    if (tenantA.map((item) => item.id).join("|") !== "request-pending|request-approved") throw new Error("Aislamiento u orden de arrendatario incorrecto");
    if (landlordA.map((item) => item.id).join("|") !== "request-pending|request-approved") throw new Error("Aislamiento u orden de arrendador incorrecto");
    if (municipality.map((item) => item.id).join("|") !== "request-pending|request-approved|request-rejected") throw new Error("Visibilidad municipal u orden incorrecto");
    const approved = tenantA.find((item) => item.id === "request-approved");
    if (!approved || approved.status !== "APROBADO" || approved.startDate !== null || approved.endDate !== null || approved.properties.monthlyRent !== 500 || approved.users.phone !== "111" || approved.users.nationalId !== "a-id") throw new Error("Paridad de campos o nulos incorrecta");
    if (JSON.stringify(municipality).includes("passwordHash")) throw new Error("Campo sensible expuesto");
    await client.query("ROLLBACK");
    console.log("POSTGRES CONTRACT REQUESTS INTEGRATION: OK");
    console.log("roles_order_joins_dates_nulls: OK");
    console.log("sensitive_fields: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Contract requests integration failed");
  process.exitCode = 1;
}).finally(async () => {
  await postgres.end();
});
