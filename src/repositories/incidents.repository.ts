import type { QueryResultRow } from "pg";
import type { IncidentStatus } from "@/lib/temporal-state-validation";
export type IncidentReport = { id: string; contractId: string; propertyId: string; tenantId: string; landlordId: string; description: string; incidentDate: Date; status: string; createdAt: Date; updatedAt: Date; properties: { id: string; title: string; address: string }; users_incident_reports_tenantIdTousers: { id: string; fullName: string; email: string } };
export type IncidentContract = { id: string; propertyId: string; tenantId: string; landlordId: string; status: string };
export type IncidentWrite = { id: string; contractId: string; propertyId: string; tenantId: string; landlordId: string; description: string; incidentDate: Date; updatedAt: Date };
export interface IncidentsSqlExecutor { query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: Row[] }> }
const BASE = `SELECT r.id,r."contractId",r."propertyId",r."tenantId",r."landlordId",r.description,r."incidentDate",r.status,r."createdAt",r."updatedAt",jsonb_build_object('id',p.id,'title',p.title,'address',p.address) AS properties,jsonb_build_object('id',t.id,'fullName',t."fullName",'email',t.email) AS "users_incident_reports_tenantIdTousers" FROM public.incident_reports r JOIN public.properties p ON p.id=r."propertyId" JOIN public.users t ON t.id=r."tenantId"`;
export class IncidentsRepository {
  constructor(private readonly executor: IncidentsSqlExecutor) {}

  async list(role: string, userId: string) {
    const clause = role === "ARRENDATARIO" ? 'WHERE r."tenantId" = $1' : role === "ARRENDADOR" ? 'WHERE r."landlordId" = $1' : "";
    const result = await this.executor.query<IncidentReport>(`${BASE} ${clause} ORDER BY r."createdAt" DESC`, clause ? [userId] : []);
    return result.rows;
  }

  async findActiveContractForTenant(contractId: string, tenantId: string): Promise<IncidentContract | null> {
    const result = await this.executor.query<IncidentContract>(
      'SELECT id,"propertyId","tenantId","landlordId",status FROM public.contracts WHERE id = $1 AND "tenantId" = $2',
      [contractId, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async create(input: IncidentWrite): Promise<IncidentReport> {
    const result = await this.executor.query<IncidentReport>(
      'INSERT INTO public.incident_reports (id,"contractId","propertyId","tenantId","landlordId",description,"incidentDate","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,"contractId","propertyId","tenantId","landlordId",description,"incidentDate",status,"createdAt","updatedAt"',
      [input.id, input.contractId, input.propertyId, input.tenantId, input.landlordId, input.description, input.incidentDate, input.updatedAt],
    );
    return result.rows[0]!;
  }

  async findForLandlord(id: string, landlordId: string): Promise<{ id: string; landlordId: string; status: string } | null> {
    const result = await this.executor.query<{ id: string; landlordId: string; status: string }>(
      'SELECT id,"landlordId",status FROM public.incident_reports WHERE id = $1 AND "landlordId" = $2',
      [id, landlordId],
    );
    return result.rows[0] ?? null;
  }

  async updateStatus(id: string, status: IncidentStatus, updatedAt: Date): Promise<IncidentReport> {
    const result = await this.executor.query<IncidentReport>(
      'UPDATE public.incident_reports SET status = $2,"updatedAt" = $3 WHERE id = $1 RETURNING id,"contractId","propertyId","tenantId","landlordId",description,"incidentDate",status,"createdAt","updatedAt"',
      [id, status, updatedAt],
    );
    return result.rows[0]!;
  }
}
