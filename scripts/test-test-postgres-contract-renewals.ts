import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { ContractRenewalsRepository, type ContractRenewalsSqlExecutor } from "../src/repositories/contract-renewals.repository";

const PROJECT = "ycerwszvzkmyisflxkpe";

async function main() {
  if (testPostgresConfig.user !== `postgres.${PROJECT}`) throw new Error("Destino temporal no confirmado");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("Sesion fuera de manta360prueba");
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",role,\"updatedAt\") VALUES ('renewal-tenant-a','renewal-tenant-a@test','hash-a','Tenant A','ARRENDATARIO',CURRENT_TIMESTAMP),('renewal-tenant-b','renewal-tenant-b@test','hash-b','Tenant B','ARRENDATARIO',CURRENT_TIMESTAMP),('renewal-landlord-a','renewal-landlord-a@test','hash-c','Landlord A','ARRENDADOR',CURRENT_TIMESTAMP),('renewal-landlord-b','renewal-landlord-b@test','hash-d','Landlord B','ARRENDADOR',CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",\"updatedAt\") VALUES ('renewal-property-a','renewal-landlord-a','Property A','Manta A',500,CURRENT_TIMESTAMP),('renewal-property-b','renewal-landlord-b','Property B','Manta B',600,CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.contracts (id,\"propertyId\",\"tenantId\",\"landlordId\",\"startDate\",\"endDate\",status,\"createdAt\",\"updatedAt\") VALUES ('renewal-contract-a','renewal-property-a','renewal-tenant-a','renewal-landlord-a','2026-01-01','2026-12-31','EN_RENOVACION','2026-01-01',CURRENT_TIMESTAMP),('renewal-contract-b','renewal-property-b','renewal-tenant-b','renewal-landlord-b','2026-01-01','2026-12-31','ACTIVO','2026-01-01',CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.contract_renewal_requests (id,\"contractId\",\"requestedBy\",\"proposedEndDate\",status,\"createdAt\",\"updatedAt\") VALUES ('renewal-pending','renewal-contract-a','renewal-tenant-a','2027-01-01','PENDIENTE','2026-08-03',CURRENT_TIMESTAMP),('renewal-approved','renewal-contract-a','renewal-tenant-a','2027-02-01','APROBADO','2026-08-02',CURRENT_TIMESTAMP),('renewal-rejected','renewal-contract-a','renewal-tenant-a','2027-03-01','RECHAZADO','2026-08-01',CURRENT_TIMESTAMP),('renewal-other','renewal-contract-b','renewal-tenant-b','2027-04-01','PENDIENTE','2026-08-04',CURRENT_TIMESTAMP)",
    );

    const repository = new ContractRenewalsRepository(client as unknown as ContractRenewalsSqlExecutor);
    const tenantA = await repository.listForSession("ARRENDATARIO", "renewal-tenant-a");
    const landlordA = await repository.listForSession("ARRENDADOR", "renewal-landlord-a");
    const tenantB = await repository.listForSession("ARRENDATARIO", "renewal-tenant-b");
    const landlordB = await repository.listForSession("ARRENDADOR", "renewal-landlord-b");
    if (tenantA.map((item) => item.id).join("|") !== "renewal-pending|renewal-approved|renewal-rejected" || landlordA.map((item) => item.id).join("|") !== "renewal-pending|renewal-approved|renewal-rejected") throw new Error("Aislamiento u orden de renovaciones propias incorrecto");
    if (tenantB.map((item) => item.id).join("|") !== "renewal-other" || landlordB.map((item) => item.id).join("|") !== "renewal-other") throw new Error("Aislamiento de usuarios ajenos incorrecto");
    const approved = tenantA.find((item) => item.id === "renewal-approved");
    if (!approved) throw new Error("Renovacion aprobada no encontrada");
    if (approved.status !== "APROBADO") throw new Error(`Estado de renovacion incorrecto: ${approved.status}`);
    if (approved.proposedEndDate.toISOString() !== "2027-02-01T00:00:00.000Z") throw new Error(`Fecha propuesta incorrecta: ${approved.proposedEndDate.toISOString()}`);
    if (approved.contract.startDate.toISOString() !== "2026-01-01T00:00:00.000Z" || approved.contract.endDate.toISOString() !== "2026-12-31T00:00:00.000Z") throw new Error("Fechas contractuales incorrectas");
    if (approved.contract.id !== "renewal-contract-a") throw new Error(`Contrato asociado incorrecto: ${approved.contract.id}`);
    if (approved.contract.status !== "EN_RENOVACION") throw new Error(`Estado contractual incorrecto: ${approved.contract.status}`);
    if (approved.contract.properties.title !== "Property A") throw new Error(`Propiedad asociada incorrecta: ${approved.contract.properties.title}`);
    if (JSON.stringify(tenantA).includes("passwordHash")) throw new Error("Campo sensible expuesto");
    await client.query("ROLLBACK");
    console.log("POSTGRES CONTRACT RENEWALS INTEGRATION: OK");
    console.log("roles_order_statuses_joins_dates_sensitive_fields: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Contract renewals integration failed");
  process.exitCode = 1;
}).finally(async () => {
  await postgres.end();
});
