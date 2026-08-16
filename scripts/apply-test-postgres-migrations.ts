import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgres, testPostgresConfig } from "../src/lib/postgres";

const EXPECTED_PROJECT_REF = "ycerwszvzkmyisflxkpe";

async function main() {
  if (testPostgresConfig.user !== `postgres.${EXPECTED_PROJECT_REF}`) throw new Error("El usuario configurado no corresponde a manta360prueba");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("La sesión activa no corresponde a la base temporal");
    const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../database/migrations");
    const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
    for (const file of files) await client.query(await readFile(path.join(migrationsDir, file), "utf8"));
    console.log(`POSTGRES TEST MIGRATIONS: OK (${files.length})`);
  } finally {
    client.release();
  }
}

main().catch(() => { console.error("POSTGRES TEST MIGRATIONS: ERROR"); process.exitCode = 1; }).finally(async () => { await postgres.end(); });
