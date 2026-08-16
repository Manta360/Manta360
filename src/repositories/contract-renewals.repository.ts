import type { QueryResultRow } from "pg";

export type ContractRenewal = {
  id: string;
  contractId: string;
  requestedBy: string;
  proposedEndDate: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  contract: {
    id: string;
    startDate: Date;
    endDate: Date;
    status: string;
    properties: { id: string; title: string; address: string };
  };
};

export type ContractRenewalsSqlResult<Row> = { rows: Row[] };
export interface ContractRenewalsSqlExecutor {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<ContractRenewalsSqlResult<Row>>;
}

const LIST_RENEWALS_SQL = `
  SELECT r.id, r."contractId", r."requestedBy", r."proposedEndDate" AT TIME ZONE 'UTC' AS "proposedEndDate", r.status,
    r."createdAt" AT TIME ZONE 'UTC' AS "createdAt", r."updatedAt" AT TIME ZONE 'UTC' AS "updatedAt",
    c.id AS "renewalContractId", c."startDate" AT TIME ZONE 'UTC' AS "contractStartDate",
    c."endDate" AT TIME ZONE 'UTC' AS "contractEndDate", c.status AS "contractStatus",
    p.id AS "contractPropertyId", p.title AS "contractPropertyTitle", p.address AS "contractPropertyAddress"
  FROM public.contract_renewal_requests r
  JOIN public.contracts c ON c.id = r."contractId"
  JOIN public.properties p ON p.id = c."propertyId"
`;

type ContractRenewalRow = Omit<ContractRenewal, "contract"> & {
  renewalContractId: string;
  contractStartDate: Date;
  contractEndDate: Date;
  contractStatus: string;
  contractPropertyId: string;
  contractPropertyTitle: string;
  contractPropertyAddress: string;
};

export class ContractRenewalsRepository {
  constructor(private readonly executor: ContractRenewalsSqlExecutor) {}

  async listForSession(role: "ARRENDATARIO" | "ARRENDADOR", userId: string): Promise<ContractRenewal[]> {
    const where = role === "ARRENDATARIO" ? 'WHERE c."tenantId" = $1' : 'WHERE c."landlordId" = $1';
    const result = await this.executor.query<ContractRenewalRow>(
      `${LIST_RENEWALS_SQL} ${where} ORDER BY r."createdAt" DESC`,
      [userId],
    );
    return result.rows.map(({ renewalContractId, contractStartDate, contractEndDate, contractStatus, contractPropertyId, contractPropertyTitle, contractPropertyAddress, ...renewal }) => ({
      ...renewal,
      contract: {
        id: renewalContractId,
        startDate: contractStartDate,
        endDate: contractEndDate,
        status: contractStatus,
        properties: { id: contractPropertyId, title: contractPropertyTitle, address: contractPropertyAddress },
      },
    }));
  }
}
