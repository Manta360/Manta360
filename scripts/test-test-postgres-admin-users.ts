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
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",phone,\"nationalId\",role,active,\"disabledAt\",\"disabledBy\",\"disableReason\",\"createdAt\",\"updatedAt\") VALUES ('admin-users-municipio','admin-users-municipio@test','hash-m','Municipio',NULL,NULL,'MUNICIPIO',true,NULL,NULL,NULL,'2026-08-04',CURRENT_TIMESTAMP),('admin-users-landlord-a','admin-users-a@test','hash-a','Landlord A','099','1316551017','ARRENDADOR',true,NULL,NULL,NULL,'2026-08-03','2026-08-04'),('admin-users-landlord-b','admin-users-b@test','hash-b','Landlord B',NULL,NULL,'ARRENDADOR',false,'2026-08-01','admin-users-municipio','Motivo','2026-08-02','2026-08-03'),('admin-users-tenant','admin-users-tenant@test','hash-t','Tenant',NULL,NULL,'ARRENDATARIO',true,NULL,NULL,NULL,'2026-08-05',CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",\"updatedAt\") VALUES ('admin-users-property-a1','admin-users-landlord-a','A1','Manta',500,CURRENT_TIMESTAMP),('admin-users-property-a2','admin-users-landlord-a','A2','Manta',600,CURRENT_TIMESTAMP),('admin-users-property-b','admin-users-landlord-b','B','Manta',700,CURRENT_TIMESTAMP)",
    );
    const landlords = await new AdminUsersRepository(client as unknown as AdminUsersSqlExecutor).listLandlords();
    if (landlords.map((item) => item.id).join("|") !== "admin-users-landlord-a|admin-users-landlord-b") throw new Error("Filtro de rol u orden de arrendadores incorrecto");
    const first = landlords[0];
    const second = landlords[1];
    if (!first || first.propertiesCount !== 2 || first.createdAt.toISOString() !== "2026-08-03T00:00:00.000Z" || first.disabledAt !== null || !second || second.propertiesCount !== 1 || second.disabledAt?.toISOString() !== "2026-08-01T00:00:00.000Z" || second.disabledBy !== "admin-users-municipio" || second.disableReason !== "Motivo") throw new Error("Paridad de campos, fechas, nulls o conteos incorrecta");
    if (JSON.stringify(landlords).includes("passwordHash")) throw new Error("Campo sensible expuesto");
    await client.query("ROLLBACK");
    console.log("POSTGRES ADMIN USERS INTEGRATION: OK");
    console.log("role_order_counts_dates_nulls_sensitive_fields: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin users integration failed");
  process.exitCode = 1;
}).finally(async () => {
  await postgres.end();
});
