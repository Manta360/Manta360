import { Pool } from "pg";
import "dotenv/config";

const APPLICATION_PROJECT_REF = "ycerwszvzkmyisflxkpe";

function requiredApplicationEnv(name: "PG_APP_HOST" | "PG_APP_PORT" | "PG_APP_DATABASE" | "PG_APP_USER" | "PG_APP_PASSWORD" | "PG_APP_PROJECT_REF"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} es obligatoria para la conexión PostgreSQL de aplicación`);
  return value;
}

function applicationPostgresConfiguration() {
  const host = requiredApplicationEnv("PG_APP_HOST");
  const port = Number(requiredApplicationEnv("PG_APP_PORT"));
  const database = requiredApplicationEnv("PG_APP_DATABASE");
  const user = requiredApplicationEnv("PG_APP_USER");
  const password = requiredApplicationEnv("PG_APP_PASSWORD");
  const projectRef = requiredApplicationEnv("PG_APP_PROJECT_REF");

  if (projectRef !== APPLICATION_PROJECT_REF) throw new Error("PG_APP_PROJECT_REF no corresponde a manta360prueba");
  if (!host.endsWith(".pooler.supabase.com")) throw new Error("PG_APP_HOST debe usar el pooler de Supabase");
  if (port !== 5432) throw new Error("PG_APP_PORT debe corresponder al Session Pooler (5432)");
  if (database !== "postgres") throw new Error("PG_APP_DATABASE debe ser postgres");
  if (user !== `postgres.${APPLICATION_PROJECT_REF}`) throw new Error("PG_APP_USER no corresponde a manta360prueba");

  return { host, port, database, user, password };
}

export const appPostgresConfig = applicationPostgresConfiguration();

type GlobalApplicationPostgres = typeof globalThis & { manta360ApplicationPostgresPool?: Pool };
const globalForApplicationPostgres = globalThis as GlobalApplicationPostgres;

/** Shared application pool. It never falls back to DATABASE_URL. */
export const applicationPostgres = globalForApplicationPostgres.manta360ApplicationPostgresPool ?? new Pool({
  ...appPostgresConfig,
  ssl: { rejectUnauthorized: false },
});

if (process.env.NODE_ENV !== "production") globalForApplicationPostgres.manta360ApplicationPostgresPool = applicationPostgres;
