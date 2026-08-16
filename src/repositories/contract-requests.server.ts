import type { PoolClient } from "pg";
import { applicationPostgres } from "@/lib/postgres-app";
import { ContractRequestsRepository } from "@/repositories/contract-requests.repository";
import { ContractsRepository } from "@/repositories/contracts.repository";

export const contractRequestsRepository = new ContractRequestsRepository(applicationPostgres);

export async function runContractRequestsTransaction<T>(operation: (requests: ContractRequestsRepository, contracts: ContractsRepository) => Promise<T>): Promise<T> {
  const client = await applicationPostgres.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const result = await operation(new ContractRequestsRepository(client as PoolClient), new ContractsRepository(client as PoolClient));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
