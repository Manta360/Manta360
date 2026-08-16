import { applicationPostgres } from "@/lib/postgres-app";
import { PropertiesRepository } from "@/repositories/properties.repository";
export const propertiesRepository = new PropertiesRepository(applicationPostgres);
