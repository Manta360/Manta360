import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { ContractsRepository, type ContractsSqlExecutor } from "../src/repositories/contracts.repository";

const PROJECT = "ycerwszvzkmyisflxkpe";
const NOW = new Date("2026-08-16T00:00:00.000Z");

async function value(client: ContractsSqlExecutor, text: string, id: string) {
  const result = await client.query<{ value: string | Date | null }>(text, [id]);
  return result.rows[0]?.value ?? null;
}

async function main() {
  if (testPostgresConfig.user !== `postgres.${PROJECT}`) throw new Error("Destino temporal no confirmado");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("Sesion fuera de manta360prueba");
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",role,\"updatedAt\") VALUES ('contract-tenant-a','contract-tenant-a@test','hash','Tenant A','ARRENDATARIO',CURRENT_TIMESTAMP),('contract-tenant-b','contract-tenant-b@test','hash','Tenant B','ARRENDATARIO',CURRENT_TIMESTAMP),('contract-landlord-a','contract-landlord-a@test','hash','Landlord A','ARRENDADOR',CURRENT_TIMESTAMP),('contract-landlord-b','contract-landlord-b@test','hash','Landlord B','ARRENDADOR',CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",status,\"updatedAt\") VALUES ('contract-active-property','contract-landlord-a','Active','A',700,'OCUPADO',CURRENT_TIMESTAMP),('contract-expired-property','contract-landlord-a','Expired','B',700,'OCUPADO',CURRENT_TIMESTAMP),('contract-maintenance-property','contract-landlord-a','Maintenance','C',700,'MANTENIMIENTO',CURRENT_TIMESTAMP),('contract-disabled-property','contract-landlord-a','Disabled','D',700,'INHABILITADO',CURRENT_TIMESTAMP),('contract-equality-property','contract-landlord-a','Equality','E',700,'OCUPADO',CURRENT_TIMESTAMP),('contract-final-property','contract-landlord-a','Final','F',700,'DISPONIBLE',CURRENT_TIMESTAMP),('contract-other-property','contract-landlord-b','Other','G',800,'DISPONIBLE',CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.contracts (id,\"propertyId\",\"tenantId\",\"landlordId\",\"startDate\",\"endDate\",status,\"monthlyRent\",\"createdAt\",\"updatedAt\") VALUES ('contract-active','contract-active-property','contract-tenant-a','contract-landlord-a','2026-01-01','2026-12-31','ACTIVO',700,'2026-08-07',CURRENT_TIMESTAMP),('contract-expired','contract-expired-property','contract-tenant-a','contract-landlord-a','2026-01-01','2026-08-15','ACTIVO',700,'2026-08-06',CURRENT_TIMESTAMP),('contract-renew-expired','contract-maintenance-property','contract-tenant-a','contract-landlord-a','2026-01-01','2026-08-15','EN_RENOVACION',700,'2026-08-05',CURRENT_TIMESTAMP),('contract-disabled-expired','contract-disabled-property','contract-tenant-a','contract-landlord-a','2026-01-01','2026-08-15','ACTIVO',700,'2026-08-04',CURRENT_TIMESTAMP),('contract-equality','contract-equality-property','contract-tenant-a','contract-landlord-a','2026-01-01','2026-08-16','ACTIVO',700,'2026-08-03',CURRENT_TIMESTAMP),('contract-final','contract-final-property','contract-tenant-a','contract-landlord-a','2026-01-01','2026-07-01','FINALIZADO',NULL,'2026-08-02',CURRENT_TIMESTAMP),('contract-other','contract-other-property','contract-tenant-b','contract-landlord-b','2026-01-01','2026-12-31','PENDIENTE_FIRMA',800,'2026-08-01',CURRENT_TIMESTAMP)",
    );

    const repository = new ContractsRepository(client as unknown as ContractsSqlExecutor);
    if (await repository.reconcileExpiredContracts(NOW) !== 3) throw new Error("Reconciliacion de expirados incorrecta");
    if (await repository.reconcileExpiredContracts(NOW) !== 0) throw new Error("Reconciliacion no idempotente");
    const expiredStatus = await value(client, "SELECT status::text AS value FROM public.contracts WHERE id = $1", "contract-expired");
    const expiredEndedBy = await value(client, "SELECT \"endedBy\" AS value FROM public.contracts WHERE id = $1", "contract-expired");
    const expiredEndedAt = await value(client, "SELECT \"endedAt\" AS value FROM public.contracts WHERE id = $1", "contract-expired");
    if (expiredStatus !== "FINALIZADO" || expiredEndedBy !== null || !(expiredEndedAt instanceof Date) || expiredEndedAt.toISOString() !== NOW.toISOString()) throw new Error("Finalizacion automatica incorrecta");
    if (await value(client, "SELECT status::text AS value FROM public.contracts WHERE id = $1", "contract-equality") !== "ACTIVO") throw new Error("La igualdad de endDate no preservo el contrato");
    if (await value(client, "SELECT status::text AS value FROM public.properties WHERE id = $1", "contract-expired-property") !== "DISPONIBLE") throw new Error("Propiedad ocupada no fue liberada");
    if (await value(client, "SELECT status::text AS value FROM public.properties WHERE id = $1", "contract-maintenance-property") !== "MANTENIMIENTO") throw new Error("Mantenimiento fue sobrescrito");
    if (await value(client, "SELECT status::text AS value FROM public.properties WHERE id = $1", "contract-disabled-property") !== "INHABILITADO") throw new Error("Inhabilitacion fue sobrescrita");

    const tenant = await repository.listForSession("ARRENDATARIO", "contract-tenant-a");
    const landlord = await repository.listForSession("ARRENDADOR", "contract-landlord-a");
    const municipality = await repository.listForSession("MUNICIPIO", "contract-municipio");
    if (tenant.length !== 6 || landlord.length !== 6 || municipality.length !== 7) throw new Error("Aislamiento por rol incorrecto");
    if (tenant.map((contract) => contract.id).join("|") !== "contract-active|contract-expired|contract-renew-expired|contract-disabled-expired|contract-equality|contract-final") throw new Error("Orden de listado incorrecto");
    if (tenant.some((contract) => contract.id === "contract-other") || landlord.some((contract) => contract.id === "contract-other")) throw new Error("Contrato ajeno expuesto");
    const finalized = tenant.find((contract) => contract.id === "contract-expired");
    if (!finalized || finalized.monthlyRent !== "700.00" || finalized.endedAt === null || finalized.endedBy !== null || finalized.properties.title !== "Expired" || finalized.users_contracts_tenantIdTousers.email !== "contract-tenant-a@test") throw new Error("Paridad de listado incorrecta");
    if (JSON.stringify(municipality).includes("passwordHash")) throw new Error("Campo sensible expuesto");
    await client.query("ROLLBACK");
    console.log("POSTGRES CONTRACTS INTEGRATION: OK");
    console.log("lifecycle_roles_order_joins_dates_nulls: OK");
    console.log("property_state_idempotence: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Contracts integration failed");
  process.exitCode = 1;
}).finally(async () => {
  await postgres.end();
});
