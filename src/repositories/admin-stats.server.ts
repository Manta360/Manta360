import { applicationPostgres } from "@/lib/postgres-app";
import { AdminStatsRepository } from "@/repositories/admin-stats.repository";

export const adminStatsRepository = new AdminStatsRepository(applicationPostgres);
