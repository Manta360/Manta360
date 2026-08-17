import { Pool, type QueryResultRow } from "pg";

function requireTestPostgresConfig() {
  const host = process.env.PG_TEST_HOST;
  const portValue = process.env.PG_TEST_PORT;
  const database = process.env.PG_TEST_DATABASE;
  const user = process.env.PG_TEST_USER;
  const password = process.env.PG_TEST_PASSWORD;

  if (!host || !portValue || !database || !user || !password) {
    throw new Error("Las variables PG_TEST_HOST, PG_TEST_PORT, PG_TEST_DATABASE, PG_TEST_USER y PG_TEST_PASSWORD son obligatorias");
  }

  const port = Number(portValue);
  if (!host.endsWith(".pooler.supabase.com") || port !== 5432 || database !== "postgres" || !user.startsWith("postgres.")) {
    throw new Error("La configuración PostgreSQL temporal no cumple el destino Supabase Session Pooler esperado");
  }

  return { host, port, database, user, password };
}

export const testPostgresConfig = requireTestPostgresConfig();

type GlobalPostgres = typeof globalThis & {
  manta360TestPostgresPool?: Pool;
};

const globalForPostgres = globalThis as GlobalPostgres;

/**
 * Isolated reusable pool for the disposable Supabase project used during the
 * database transition. It intentionally has no fallback to application settings.
 */
export const postgres =
  globalForPostgres.manta360TestPostgresPool ??
  new Pool({
    ...testPostgresConfig,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

globalForPostgres.manta360TestPostgresPool = postgres;

export function queryPostgres<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
) {
  return postgres.query<Row>(text, [...values]);
}
