import { ContractStatus, Prisma, PropertyStatus } from "@prisma/client";
import { activeContractStatuses } from "@/lib/contract-exclusivity";

export const terminableContractStatuses = [
  ContractStatus.ACTIVO,
  ContractStatus.EN_RENOVACION,
] as const;

export function isTerminableContractStatus(status: ContractStatus) {
  return terminableContractStatuses.includes(status as (typeof terminableContractStatuses)[number]);
}

/**
 * Finalizes contracts whose end date has already passed. This receives the
 * caller's transaction so expiration and any required property release are
 * committed atomically with the operation that discovered the expiration.
 */
export async function reconcileExpiredContracts(
  tx: Prisma.TransactionClient,
  now = new Date(),
) {
  const expiredContracts = await tx.contracts.findMany({
    where: {
      status: { in: [...activeContractStatuses] },
      endDate: { lt: now },
    },
    select: { id: true, propertyId: true },
  });

  let finalized = 0;
  for (const contract of expiredContracts) {
    const result = await tx.contracts.updateMany({
      where: {
        id: contract.id,
        status: { in: [...activeContractStatuses] },
        endDate: { lt: now },
      },
      data: {
        status: ContractStatus.FINALIZADO,
        endedAt: now,
        endedBy: null,
        updatedAt: now,
      },
    });
    if (result.count !== 1) continue;
    finalized += 1;
    await tx.properties.updateMany({
      where: { id: contract.propertyId, status: PropertyStatus.OCUPADO },
      data: { status: PropertyStatus.DISPONIBLE, updatedAt: now },
    });
  }

  return finalized;
}
