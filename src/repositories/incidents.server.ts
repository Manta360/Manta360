import { applicationPostgres } from "@/lib/postgres-app";
import { IncidentsRepository } from "@/repositories/incidents.repository";
export const incidentsRepository = new IncidentsRepository(applicationPostgres);
