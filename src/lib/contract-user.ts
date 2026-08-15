import type { Prisma } from "@prisma/client";

/**
 * User data required by contract screens. Credentials and account-management
 * metadata must never be included in relationship payloads.
 */
export const contractUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  nationalId: true,
} satisfies Prisma.UserSelect;

type ContractUser = Prisma.UserGetPayload<{ select: typeof contractUserSelect }>;

export function toContractUser(user: ContractUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    nationalId: user.nationalId,
  };
}
