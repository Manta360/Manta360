import "dotenv/config";
import type { QueryResultRow } from "pg";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { AdminStatsRepository, type AdminStatsSqlExecutor } from "../src/repositories/admin-stats.repository";

const PROJECT = "ycerwszvzkmyisflxkpe";

async function main() {
  if (testPostgresConfig.user !== `postgres.${PROJECT}`) throw new Error("Destino temporal no confirmado");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("Sesion fuera de manta360prueba");
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",active,role,\"updatedAt\") VALUES ('stats-tenant','stats-tenant@test','hash-tenant','Tenant',true,'ARRENDATARIO',CURRENT_TIMESTAMP),('stats-landlord-a','stats-landlord-a@test','hash-a','Ana',true,'ARRENDADOR',CURRENT_TIMESTAMP),('stats-landlord-b','stats-landlord-b@test','hash-b','Bea',false,'ARRENDADOR',CURRENT_TIMESTAMP),('stats-landlord-c','stats-landlord-c@test','hash-c','Carlos',true,'ARRENDADOR',CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.properties (id,\"landlordId\",title,address,\"monthlyRent\",status,approved,\"updatedAt\") VALUES ('stats-tarqui-a','stats-landlord-a','Tarqui A','TARQUI, Manta',100.10,'OCUPADO',true,CURRENT_TIMESTAMP),('stats-tarqui-b','stats-landlord-a','Tarqui B','Tarqui - sector residencial',299.90,'DISPONIBLE',true,CURRENT_TIMESTAMP),('stats-centro','stats-landlord-a','Centro','CÉNTRO, Manta',250,'DISPONIBLE',true,CURRENT_TIMESTAMP),('stats-unknown','stats-landlord-a','Unknown','Av. Flavio Reyes',500,'DISPONIBLE',true,CURRENT_TIMESTAMP),('stats-unapproved','stats-landlord-a','Unapproved','La Pradera',800,'DISPONIBLE',false,CURRENT_TIMESTAMP),('stats-disabled','stats-landlord-a','Disabled','Barbasquillo',900,'INHABILITADO',true,CURRENT_TIMESTAMP),('stats-bea-a','stats-landlord-b','Bea A','Tarqui',400,'DISPONIBLE',false,CURRENT_TIMESTAMP),('stats-bea-b','stats-landlord-b','Bea B','Tarqui',400,'DISPONIBLE',false,CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.contracts (id,\"propertyId\",\"tenantId\",\"landlordId\",\"startDate\",\"endDate\",status,\"createdAt\",\"updatedAt\") VALUES ('stats-contract','stats-tarqui-a','stats-tenant','stats-landlord-a','2026-01-01','2026-12-31','ACTIVO','2026-01-01',CURRENT_TIMESTAMP)",
    );
    await client.query(
      "INSERT INTO public.incident_reports (id,\"contractId\",\"propertyId\",\"tenantId\",\"landlordId\",description,\"incidentDate\",status,\"createdAt\",\"updatedAt\") VALUES ('stats-pending','stats-contract','stats-tarqui-a','stats-tenant','stats-landlord-a','Pending','2026-08-01','PENDIENTE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),('stats-resolved','stats-contract','stats-tarqui-a','stats-tenant','stats-landlord-a','Resolved','2026-08-02','RESUELTO',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
    );

    let queuedQuery = Promise.resolve();
    const transactionExecutor: AdminStatsSqlExecutor = {
      query<Row extends QueryResultRow>(text: string, values?: unknown[]) {
        const next = queuedQuery.then(() => client.query<Row>(text, values));
        queuedQuery = next.then(() => undefined, () => undefined);
        return next;
      },
    };
    const statistics = await new AdminStatsRepository(transactionExecutor).getStatistics();
    if (JSON.stringify(statistics.propertiesByZone) !== JSON.stringify([{ zone: "Tarqui", count: 2 }, { zone: "Centro", count: 1 }, { zone: "Zona no clasificada", count: 1 }])) throw new Error("Clasificacion, filtros u orden de zonas incorrectos");
    if (JSON.stringify(statistics.averageRentByZone) !== JSON.stringify([{ zone: "Tarqui", averageRent: 200 }, { zone: "Centro", averageRent: 250 }, { zone: "Zona no clasificada", averageRent: 500 }])) throw new Error("Promedios por zona incorrectos");
    if (JSON.stringify(statistics.incidentsByStatus) !== JSON.stringify({ PENDIENTE: 1, EN_PROCESO: 0, RESUELTO: 1 })) throw new Error("Estados de incidencia o ceros incorrectos");
    if (JSON.stringify(statistics.topLandlords) !== JSON.stringify([{ id: "stats-landlord-a", fullName: "Ana", active: true, propertiesCount: 6 }, { id: "stats-landlord-b", fullName: "Bea", active: false, propertiesCount: 2 }, { id: "stats-landlord-c", fullName: "Carlos", active: true, propertiesCount: 0 }])) throw new Error("Ranking o conteo de arrendadores incorrecto");
    if (JSON.stringify(statistics).includes("passwordHash")) throw new Error("Campo sensible expuesto");
    await client.query("ROLLBACK");
    console.log("POSTGRES ADMIN STATS INTEGRATION: OK");
    console.log("zones_filters_averages_counts_ranking_sensitive_fields: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin stats integration failed");
  process.exitCode = 1;
}).finally(async () => {
  await postgres.end();
});
