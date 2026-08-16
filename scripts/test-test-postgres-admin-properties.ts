import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { AdminPropertiesRepository, type AdminPropertiesSqlExecutor } from "../src/repositories/admin-properties.repository";

const PROJECT = "ycerwszvzkmyisflxkpe";

async function main() {
  if (testPostgresConfig.user !== `postgres.${PROJECT}`) throw new Error("Destino temporal no confirmado");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("Sesion fuera de manta360prueba");
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",phone,\"nationalId\",role,active,\"disabledAt\",\"disableReason\",\"updatedAt\") VALUES ('admin-properties-municipio','admin-properties-municipio@test','hash-m','Municipio',NULL,NULL,'MUNICIPIO',true,NULL,NULL,CURRENT_TIMESTAMP),('admin-properties-tenant','admin-properties-tenant@test','hash-t','Tenant',NULL,NULL,'ARRENDATARIO',true,NULL,NULL,CURRENT_TIMESTAMP),('admin-properties-landlord-a','admin-properties-a@test','hash-a','Ana','099','1316551017','ARRENDADOR',true,NULL,NULL,CURRENT_TIMESTAMP),('admin-properties-landlord-b','admin-properties-b@test','hash-b','Bea',NULL,NULL,'ARRENDADOR',false,'2026-08-01','Motivo municipal',CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",status,approved,description,\"createdAt\",\"updatedAt\") VALUES ('admin-properties-a','admin-properties-landlord-a','A','Manta',700.50,'OCUPADO',true,NULL,'2026-08-03',CURRENT_TIMESTAMP),('admin-properties-b','admin-properties-landlord-b','B','Manta',800,'DISPONIBLE',false,'Pendiente','2026-08-04',CURRENT_TIMESTAMP),('admin-properties-c','admin-properties-landlord-a','C','Manta',900,'INHABILITADO',true,NULL,'2026-08-02',CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.contracts (id,\"propertyId\",\"tenantId\",\"landlordId\",\"startDate\",\"endDate\",status,\"updatedAt\") VALUES ('admin-properties-contract','admin-properties-a','admin-properties-tenant','admin-properties-landlord-a','2026-01-01','2026-12-31','ACTIVO',CURRENT_TIMESTAMP)",
    );

    const result = await new AdminPropertiesRepository(client as unknown as AdminPropertiesSqlExecutor).listForMunicipality();
    if (result.properties.map((property) => property.id).join("|") !== "admin-properties-b|admin-properties-a|admin-properties-c") throw new Error("Orden createdAt DESC incorrecto");
    if (result.properties[0]?.monthlyRent !== 800 || typeof result.properties[1]?.monthlyRent !== "number") throw new Error("monthlyRent no conserva number");
    if (JSON.stringify(result.properties[0]?.users_properties_landlordIdTousers) !== JSON.stringify({ id: "admin-properties-landlord-b", fullName: "Bea", email: "admin-properties-b@test", phone: null, nationalId: null, active: false, disabledAt: new Date("2026-08-01T00:00:00.000Z"), disableReason: "Motivo municipal" })) throw new Error("Proyeccion del arrendador o nulls incorrecta");
    if (JSON.stringify(result.stats) !== JSON.stringify({ users: 4, pendingProperties: 1, occupiedProperties: 1, activeContracts: 1, disabledLandlords: 1, disabledProperties: 1 })) throw new Error("Seis contadores incorrectos");
    if (JSON.stringify(result).includes("passwordHash")) throw new Error("Campo sensible expuesto");

    await client.query("ROLLBACK");
    console.log("POSTGRES ADMIN PROPERTIES INTEGRATION: OK");
    console.log("order_projection_rent_counts_zeros_sensitive_fields: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin properties integration failed");
  process.exitCode = 1;
}).finally(async () => {
  await postgres.end();
});
