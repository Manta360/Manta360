import { PropertyStatus, Prisma } from "@prisma/client";
import { activeContractStatuses } from "@/lib/contract-exclusivity";

/**
 * Administrative states are intentional overrides. Contract transitions must
 * never erase maintenance or municipal disablement.
 */
export function isAdministrativePropertyStatus(status: PropertyStatus) {
  return status === PropertyStatus.MANTENIMIENTO || status === PropertyStatus.INHABILITADO;
}

export async function propertyHasEffectiveContract(tx: Prisma.TransactionClient, propertyId: string) {
  return Boolean(await tx.contracts.findFirst({
    where: { propertyId, status: { in: [...activeContractStatuses] } },
    select: { id: true },
  }));
}

/**
 * Reconciles the operational property state from the effective contract set.
 * Only DISPONIBLE and OCUPADO are contract-managed; MANTENIMIENTO and
 * INHABILITADO remain explicit administrative decisions.
 */
export async function synchronizePropertyContractState(
  tx: Prisma.TransactionClient,
  propertyId: string,
  now = new Date(),
) {
  const property = await tx.properties.findUnique({
    where: { id: propertyId },
    select: { id: true, status: true },
  });
  if (!property || isAdministrativePropertyStatus(property.status)) {
    return { property, changed: false };
  }

  const hasEffectiveContract = await propertyHasEffectiveContract(tx, propertyId);
  const expectedStatus = hasEffectiveContract ? PropertyStatus.OCUPADO : PropertyStatus.DISPONIBLE;
  if (property.status === expectedStatus) return { property, changed: false };

  const result = await tx.properties.updateMany({
    where: { id: propertyId, status: { in: [PropertyStatus.DISPONIBLE, PropertyStatus.OCUPADO] } },
    data: { status: expectedStatus, updatedAt: now },
  });
  return { property, changed: result.count === 1 };
}

/**
 * Activation uses a conditional write to keep the availability decision and
 * the later contract activation in the same Serializable transaction.
 */
export async function reservePropertyForContractActivation(
  tx: Prisma.TransactionClient,
  propertyId: string,
  now = new Date(),
) {
  return tx.properties.updateMany({
    where: { id: propertyId, status: PropertyStatus.DISPONIBLE, approved: true },
    data: { status: PropertyStatus.OCUPADO, updatedAt: now },
  });
}
