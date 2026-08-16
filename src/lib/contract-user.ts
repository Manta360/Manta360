/**
 * User data required by contract screens. Credentials and account-management
 * metadata must never be included in relationship payloads.
 */
export type ContractUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  nationalId: string | null;
};

/** Legacy Prisma callers consume this projection until their write routes move. */
export const contractUserSelect = { id: true, fullName: true, email: true, phone: true, nationalId: true } as const;

export function toContractUser(user: ContractUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    nationalId: user.nationalId,
  };
}
