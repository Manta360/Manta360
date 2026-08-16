import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { ContractsRepository, type ContractsSqlExecutor } from "../src/repositories/contracts.repository";

const PROJECT = "ycerwszvzkmyisflxkpe";
const STATUSES = ["PENDIENTE_FIRMA", "PENDIENTE_MUNICIPIO", "ACTIVO", "RECHAZADO_MUNICIPIO", "FINALIZADO", "EN_RENOVACION"];

function isAccessible(contract: { tenantId: string; landlordId: string }, userId: string, role: string) {
  return role === "MUNICIPIO" || contract.tenantId === userId || contract.landlordId === userId;
}

async function main() {
  if (testPostgresConfig.user !== `postgres.${PROJECT}`) throw new Error("Destino temporal no confirmado");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("Sesion fuera de manta360prueba");
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",phone,\"nationalId\",role,\"updatedAt\") VALUES ('detail-tenant-a','detail-tenant-a@test','hash-a','Tenant A','111','tenant-a-id','ARRENDATARIO',CURRENT_TIMESTAMP),('detail-tenant-b','detail-tenant-b@test','hash-b','Tenant B','222','tenant-b-id','ARRENDATARIO',CURRENT_TIMESTAMP),('detail-landlord-a','detail-landlord-a@test','hash-c','Landlord A','333','landlord-a-id','ARRENDADOR',CURRENT_TIMESTAMP),('detail-landlord-b','detail-landlord-b@test','hash-d','Landlord B','444','landlord-b-id','ARRENDADOR',CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",status,description,bedrooms,bathrooms,latitude,longitude,approved,\"createdAt\",\"updatedAt\") VALUES ('detail-property-1','detail-landlord-a','Property 1','Manta',650,'OCUPADO','Full detail',2,1,-0.95,-80.73,true,'2026-01-01',CURRENT_TIMESTAMP),('detail-property-2','detail-landlord-a','Property 2','Manta',650,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,'2026-01-01',CURRENT_TIMESTAMP),('detail-property-3','detail-landlord-a','Property 3','Manta',650,'OCUPADO',NULL,NULL,NULL,NULL,NULL,false,'2026-01-01',CURRENT_TIMESTAMP),('detail-property-4','detail-landlord-a','Property 4','Manta',650,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,'2026-01-01',CURRENT_TIMESTAMP),('detail-property-5','detail-landlord-a','Property 5','Manta',650,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,'2026-01-01',CURRENT_TIMESTAMP),('detail-property-6','detail-landlord-a','Property 6','Manta',650,'OCUPADO',NULL,NULL,NULL,NULL,NULL,false,'2026-01-01',CURRENT_TIMESTAMP),('detail-property-other','detail-landlord-b','Other','Manta',700,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,'2026-01-01',CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.contracts (id,\"propertyId\",\"tenantId\",\"landlordId\",\"startDate\",\"endDate\",status,\"monthlyRent\",\"depositAmount\",\"landlordSignedAt\",\"tenantSignedAt\",\"endedAt\",\"endedBy\",\"createdAt\",\"updatedAt\") VALUES ('detail-pending','detail-property-1','detail-tenant-a','detail-landlord-a','2026-01-01','2026-12-31','PENDIENTE_FIRMA',650,300,NULL,NULL,NULL,NULL,'2026-01-06',CURRENT_TIMESTAMP),('detail-municipal','detail-property-2','detail-tenant-a','detail-landlord-a','2026-01-01','2026-12-31','PENDIENTE_MUNICIPIO',650,NULL,NULL,NULL,NULL,NULL,'2026-01-05',CURRENT_TIMESTAMP),('detail-active','detail-property-3','detail-tenant-a','detail-landlord-a','2026-01-01','2026-12-31','ACTIVO',650,NULL,NULL,NULL,NULL,NULL,'2026-01-04',CURRENT_TIMESTAMP),('detail-rejected','detail-property-4','detail-tenant-a','detail-landlord-a','2026-01-01','2026-12-31','RECHAZADO_MUNICIPIO',650,NULL,NULL,NULL,NULL,NULL,'2026-01-03',CURRENT_TIMESTAMP),('detail-final','detail-property-5','detail-tenant-a','detail-landlord-a','2026-01-01','2026-05-01','FINALIZADO',650,NULL,NULL,NULL,'2026-05-02','detail-tenant-a','2026-01-02',CURRENT_TIMESTAMP),('detail-renewal','detail-property-6','detail-tenant-a','detail-landlord-a','2026-01-01','2026-12-31','EN_RENOVACION',650,NULL,NULL,NULL,NULL,NULL,'2026-01-01',CURRENT_TIMESTAMP),('detail-other','detail-property-other','detail-tenant-b','detail-landlord-b','2026-01-01','2026-12-31','PENDIENTE_FIRMA',700,NULL,NULL,NULL,NULL,NULL,'2026-01-01',CURRENT_TIMESTAMP)",
    );

    const repository = new ContractsRepository(client as unknown as ContractsSqlExecutor);
    const detail = await repository.findById("detail-pending");
    if (!detail || detail.monthlyRent !== "650.00" || detail.depositAmount !== "300.00" || detail.properties.monthlyRent !== "650.00" || detail.properties.description !== "Full detail" || detail.properties.latitude !== "-0.9500000" || detail.users_contracts_tenantIdTousers.email !== "detail-tenant-a@test" || detail.users_contracts_landlordIdTousers.email !== "detail-landlord-a@test") throw new Error("Paridad de detalle incorrecta");
    if (JSON.stringify(detail).includes("passwordHash")) throw new Error("Campo sensible expuesto");
    if (await repository.findById("missing")) throw new Error("Contrato inexistente encontrado");
    for (const [index, status] of STATUSES.entries()) {
      const item = await repository.findById(["detail-pending", "detail-municipal", "detail-active", "detail-rejected", "detail-final", "detail-renewal"][index]);
      if (!item || item.status !== status) throw new Error(`Estado ${status} no preservado`);
    }
    const other = await repository.findById("detail-other");
    if (!other || !isAccessible(detail, "detail-tenant-a", "ARRENDATARIO") || !isAccessible(detail, "detail-landlord-a", "ARRENDADOR") || !isAccessible(detail, "municipio", "MUNICIPIO") || isAccessible(other, "detail-tenant-a", "ARRENDATARIO") || isAccessible(other, "detail-landlord-a", "ARRENDADOR")) throw new Error("Aislamiento de participantes incorrecto");
    const final = await repository.findById("detail-final");
    if (!final || final.endedAt === null || final.endedBy !== "detail-tenant-a") throw new Error("endedAt o endedBy no preservados");
    await client.query("ROLLBACK");
    console.log("POSTGRES CONTRACT DETAIL INTEGRATION: OK");
    console.log("access_statuses_shape_dates_sensitive_fields: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Contract detail integration failed");
  process.exitCode = 1;
}).finally(async () => {
  await postgres.end();
});
