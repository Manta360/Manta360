import type { PoolClient } from "pg";
import { applicationPostgres } from "@/lib/postgres-app";
import { IdentityRepository } from "@/repositories/identity.repository";

export const identityRepository = new IdentityRepository(applicationPostgres);

export async function runIdentityTransaction<T>(operation: (repository: IdentityRepository) => Promise<T>): Promise<T> {
  const client = await applicationPostgres.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(new IdentityRepository(client as PoolClient));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
