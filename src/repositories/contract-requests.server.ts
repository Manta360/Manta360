import { applicationPostgres } from "@/lib/postgres-app";
import { ContractRequestsRepository } from "@/repositories/contract-requests.repository";

export const contractRequestsRepository = new ContractRequestsRepository(applicationPostgres);
