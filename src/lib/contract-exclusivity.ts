import type { PoolClient } from "pg";
import { applicationPostgres } from "@/lib/postgres-app";

export const activeContractStatuses = ["ACTIVO", "EN_RENOVACION"] as const;
const MAX_SERIALIZABLE_RETRIES = 3;

function sqlState(error: unknown) { return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null; }
export function isContractExclusivityViolation(error: unknown) { return sqlState(error) === "23505"; }
export function isContractTransactionConflict(error: unknown) { const code = sqlState(error); return code === "40001" || code === "23505"; }

/** Shared SERIALIZABLE PG transaction; 40001 retries preserve the historical bound. */
export async function runContractTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_SERIALIZABLE_RETRIES; attempt += 1) {
    const client = await applicationPostgres.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (sqlState(error) === "40001" && attempt < MAX_SERIALIZABLE_RETRIES - 1) continue;
      throw error;
    } finally { client.release(); }
  }
  throw new Error("No se pudo completar la transacción contractual");
}
