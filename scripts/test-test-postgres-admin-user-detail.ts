import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { AdminUsersRepository, type AdminUsersSqlExecutor } from "../src/repositories/admin-users.repository";

const PROJECT = "ycerwszvzkmyisflxkpe";

async function main() {
  if (testPostgresConfig.user !== `postgres.${PROJECT}`) throw new Error("Destino temporal no confirmado");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("Sesion fuera de manta360prueba");
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",phone,\"nationalId\",role,active,\"disabledAt\",\"disabledBy\",\"disableReason\",\"createdAt\",\"updatedAt\") VALUES ('admin-detail-municipio','admin-detail-municipio@test','hash-m','Municipio',NULL,NULL,'MUNICIPIO',true,NULL,NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),('admin-detail-landlord-active','admin-detail-active@test','hash-a','Activo','099','1316551017','ARRENDADOR',true,NULL,NULL,NULL,'2026-08-02','2026-08-03'),('admin-detail-landlord-inactive','admin-detail-inactive@test','hash-i','Inactivo',NULL,NULL,'ARRENDADOR',false,'2026-08-01','admin-detail-municipio','Motivo','2026-08-01','2026-08-03'),('admin-detail-tenant','admin-detail-tenant@test','hash-t','Tenant',NULL,NULL,'ARRENDATARIO',true,NULL,NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
    );
    const repository = new AdminUsersRepository(client as unknown as AdminUsersSqlExecutor);
    const active = await repository.findLandlordById("admin-detail-landlord-active");
    const inactive = await repository.findLandlordById("admin-detail-landlord-inactive");
    const tenant = await repository.findLandlordById("admin-detail-tenant");
    const missing = await repository.findLandlordById("admin-detail-missing");
    if (!active?.active || active.phone !== "099" || active.nationalId !== "1316551017" || inactive?.active !== false || inactive.disabledAt?.toISOString() !== "2026-08-01T00:00:00.000Z" || inactive.disabledBy !== "admin-detail-municipio" || inactive.disableReason !== "Motivo" || tenant !== null || missing !== null) throw new Error("Filtro, datos historicos, fechas o nulls incorrectos");
    if (JSON.stringify([active, inactive]).includes("passwordHash")) throw new Error("Campo sensible expuesto");
    await client.query("ROLLBACK");
    console.log("POSTGRES ADMIN USER DETAIL INTEGRATION: OK");
    console.log("role_filter_dates_nulls_sensitive_fields: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin user detail integration failed");
  process.exitCode = 1;
}).finally(async () => {
  await postgres.end();
});
