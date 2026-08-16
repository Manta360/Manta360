import { applicationPostgres } from "@/lib/postgres-app";
import { IdentityRepository } from "@/repositories/identity.repository";

export const identityRepository = new IdentityRepository(applicationPostgres);
