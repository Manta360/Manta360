import { applicationPostgres } from "@/lib/postgres-app";
import { ContractsRepository, type ContractsSqlExecutor } from "@/repositories/contracts.repository";

const MAX_SERIALIZABLE_RETRIES = 3;

type ContractsSqlClient = ContractsSqlExecutor & { release(): void };
type ContractsSqlPool = { connect(): Promise<ContractsSqlClient> };

export const contractsRepository = new ContractsRepository(applicationPostgres);

export async function runContractsTransaction<T>(operation: (repository: ContractsRepository) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_SERIALIZABLE_RETRIES; attempt += 1) {
    const client = await applicationPostgres.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const result = await operation(new ContractsRepository(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (sqlState(error) === "40001" && attempt < MAX_SERIALIZABLE_RETRIES - 1) continue;
      throw error;
    } finally {
      client.release();
    }
  }
  throw new Error("No se pudo completar la transacción contractual");
}

function sqlState(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : null;
}

export function isPostgresContractTransactionConflict(error: unknown) {
  return sqlState(error) === "40001" || sqlState(error) === "23505";
}

/**
 * Mirrors the historical Prisma Serializable transaction used by GET
 * /api/contracts. The listing remains outside this transaction, as it was
 * before the migration.
 */
export async function reconcileExpiredContractsWithPostgres(
  pool: ContractsSqlPool = applicationPostgres,
  now = new Date(),
) {
  for (let attempt = 0; attempt < MAX_SERIALIZABLE_RETRIES; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
      const finalized = await new ContractsRepository(client).reconcileExpiredContracts(now);
      await client.query("COMMIT");
      return finalized;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (sqlState(error) === "40001" && attempt < MAX_SERIALIZABLE_RETRIES - 1) continue;
      throw error;
    } finally {
      client.release();
    }
  }

  throw new Error("No se pudo completar la transacción contractual");
}
