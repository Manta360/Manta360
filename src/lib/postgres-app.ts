import { Pool } from "pg";

const TEMPORARY_PROJECT_REF = "ycerwszvzkmyisflxkpe";

function requireApplicationDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL es obligatoria para la conexión PostgreSQL de aplicación");

  const url = new URL(connectionString);
  if (url.username === `postgres.${TEMPORARY_PROJECT_REF}`) {
    throw new Error("La conexión PostgreSQL de aplicación no puede apuntar a manta360prueba");
  }

  return connectionString;
}

type GlobalApplicationPostgres = typeof globalThis & {
  manta360ApplicationPostgresPool?: Pool;
};

const globalForApplicationPostgres = globalThis as GlobalApplicationPostgres;

/**
 * Pool for normal application traffic. It is intentionally separate from the
 * PG_TEST_* foundation so a Route Handler can never fall back to the temporary database.
 */
export const applicationPostgres =
  globalForApplicationPostgres.manta360ApplicationPostgresPool ??
  new Pool({
    connectionString: requireApplicationDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForApplicationPostgres.manta360ApplicationPostgresPool = applicationPostgres;
}
