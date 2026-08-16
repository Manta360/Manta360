import { applicationPostgres } from "@/lib/postgres-app";
import { DashboardRepository } from "@/repositories/dashboard.repository";

export const dashboardRepository = new DashboardRepository(applicationPostgres);
