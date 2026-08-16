import { applicationPostgres } from "@/lib/postgres-app";
import { AdminPropertiesRepository } from "@/repositories/admin-properties.repository";

export const adminPropertiesRepository = new AdminPropertiesRepository(applicationPostgres);
