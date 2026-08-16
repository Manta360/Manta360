import "dotenv/config";
import { createContractPdf } from "../src/lib/contract-pdf";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { ContractsRepository, type ContractsSqlExecutor } from "../src/repositories/contracts.repository";

const PROJECT = "ycerwszvzkmyisflxkpe";

function canAccess(contract: { tenantId: string; landlordId: string }, userId: string, role: string) {
  return role === "MUNICIPIO" || contract.tenantId === userId || contract.landlordId === userId;
}

async function main() {
  if (testPostgresConfig.user !== `postgres.${PROJECT}`) throw new Error("Destino temporal no confirmado");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("Sesion fuera de manta360prueba");
    await client.query("BEGIN");
    await client.query("INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",\"nationalId\",role,\"updatedAt\") VALUES ('pdf-tenant','pdf-tenant@test','tenant-secret','Tenant PDF','1111111111','ARRENDATARIO',CURRENT_TIMESTAMP),('pdf-landlord','pdf-landlord@test','landlord-secret','Landlord PDF','2222222222','ARRENDADOR',CURRENT_TIMESTAMP),('pdf-other','pdf-other@test','other-secret','Other PDF','3333333333','ARRENDATARIO',CURRENT_TIMESTAMP)");
    await client.query("INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",\"updatedAt\") VALUES ('pdf-property','pdf-landlord','Casa PDF','Av. PDF',750,CURRENT_TIMESTAMP)");
    await client.query("INSERT INTO public.contracts (id,\"propertyId\",\"tenantId\",\"landlordId\",\"startDate\",\"endDate\",status,\"monthlyRent\",purpose,\"paymentMethod\",\"updatedAt\") VALUES ('pdf-contract','pdf-property','pdf-tenant','pdf-landlord','2026-01-01','2026-12-31','ACTIVO',750,'Vivienda','Transferencia',CURRENT_TIMESTAMP)");

    const repository = new ContractsRepository(client as unknown as ContractsSqlExecutor);
    const contract = await repository.findById("pdf-contract");
    if (!contract || contract.monthlyRent !== "750.00" || contract.properties.title !== "Casa PDF" || contract.users_contracts_tenantIdTousers.nationalId !== "1111111111" || contract.users_contracts_landlordIdTousers.nationalId !== "2222222222") throw new Error("Datos contractuales PDF incorrectos");
    if (!canAccess(contract, "pdf-tenant", "ARRENDATARIO") || !canAccess(contract, "pdf-landlord", "ARRENDADOR") || !canAccess(contract, "pdf-municipio", "MUNICIPIO") || canAccess(contract, "pdf-other", "ARRENDATARIO")) throw new Error("Acceso PDF incorrecto");
    const pdf = createContractPdf({ ...contract, monthlyRent: Number(contract.monthlyRent), landlord: contract.users_contracts_landlordIdTousers, tenant: contract.users_contracts_tenantIdTousers });
    const text = new TextDecoder().decode(pdf);
    if (!text.startsWith("%PDF-1.4") || text.length < 500 || !text.includes("Contrato No. pdf-contract") || !text.includes("Casa PDF") || !text.includes("Tenant PDF") || !text.includes("Landlord PDF") || text.includes("tenant-secret") || text.includes("passwordHash")) throw new Error("PDF no equivalente o sensible");
    await client.query("ROLLBACK");
    console.log("POSTGRES CONTRACT PDF INTEGRATION: OK");
    console.log("contract_data_access_pdf_content_sensitive_fields: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Contract PDF integration failed");
  process.exitCode = 1;
}).finally(async () => {
  await postgres.end();
});
