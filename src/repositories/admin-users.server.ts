import { applicationPostgres } from "@/lib/postgres-app";
import { AdminUsersRepository } from "@/repositories/admin-users.repository";

export const adminUsersRepository = new AdminUsersRepository(applicationPostgres);
