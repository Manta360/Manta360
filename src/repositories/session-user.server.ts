import { applicationPostgres } from "@/lib/postgres-app";
import { SessionUserRepository } from "@/repositories/session-user.repository";

export const sessionUserRepository = new SessionUserRepository(applicationPostgres);
