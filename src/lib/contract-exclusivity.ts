import { ContractStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const activeContractStatuses = [
  ContractStatus.ACTIVO,
  ContractStatus.EN_RENOVACION,
] as const;

const MAX_SERIALIZABLE_RETRIES = 3;

function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export function isContractExclusivityViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isContractTransactionConflict(error: unknown) {
  return isSerializationFailure(error) || isContractExclusivityViolation(error);
}

/**
 * PostgreSQL serializable transactions make property availability checks and
 * the resulting write a single atomic decision. Retrying P2034 lets a losing
 * concurrent request observe the committed state before returning a response.
 */
export async function runContractTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; attempt < MAX_SERIALIZABLE_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === MAX_SERIALIZABLE_RETRIES - 1) throw error;
    }
  }

  throw new Error("No se pudo completar la transacción contractual");
}
