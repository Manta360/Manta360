import "dotenv/config";
import { postgres, queryPostgres, testPostgresConfig } from "../src/lib/postgres";

function redactHost(hostname: string) {
  return `${hostname.slice(0, 4)}…${hostname.slice(-19)}`;
}

function redactRole(role: string) {
  const [prefix] = role.split(".");
  return role.includes(".") ? `${prefix}.[redactado]` : "[redactado]";
}

async function main() {
  const [health, context, tables] = await Promise.all([
    queryPostgres<{ ok: number }>("SELECT 1 AS ok"),
    queryPostgres<{ database: string; role: string; version: string }>("SELECT current_database() AS database, current_user AS role, version() AS version"),
    queryPostgres<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"),
  ]);

  console.log("POSTGRES CONNECTION: OK");
  console.log(`host: ${redactHost(testPostgresConfig.host)}`);
  console.log("ssl: enabled (Supabase-compatible)");
  console.log(`select_1: ${health.rows[0]?.ok === 1 ? "OK" : "ERROR"}`);
  console.log(`database: ${context.rows[0]?.database ?? "unknown"}`);
  console.log(`current_user: ${redactRole(context.rows[0]?.role ?? "")}`);
  console.log(`server: ${context.rows[0]?.version.split(",")[0] ?? "unknown"}`);
  console.log(`public_tables: ${tables.rowCount ?? 0}${tables.rows.length ? ` (${tables.rows.map((table) => table.table_name).join(", ")})` : ""}`);
}

main()
  .catch((error: unknown) => {
    console.error("POSTGRES CONNECTION: ERROR", error instanceof Error ? error.message : "Error desconocido");
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.end();
  });
