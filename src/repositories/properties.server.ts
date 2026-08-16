import type { PoolClient } from "pg";
import { applicationPostgres } from "@/lib/postgres-app";
import { PropertiesRepository } from "@/repositories/properties.repository";
export const propertiesRepository = new PropertiesRepository(applicationPostgres);

export async function runPropertiesTransaction<T>(operation: (repository: PropertiesRepository) => Promise<T>): Promise<T> {
  const client = await applicationPostgres.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(new PropertiesRepository(client as PoolClient));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
