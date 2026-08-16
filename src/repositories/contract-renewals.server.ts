import { applicationPostgres } from "@/lib/postgres-app";
import { ContractRenewalsRepository } from "@/repositories/contract-renewals.repository";

export const contractRenewalsRepository = new ContractRenewalsRepository(applicationPostgres);
