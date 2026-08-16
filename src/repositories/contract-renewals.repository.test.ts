import { describe, expect, it, vi } from "vitest";
import { ContractRenewalsRepository } from "@/repositories/contract-renewals.repository";

describe("ContractRenewalsRepository", () => {
  it.each([
    ["ARRENDATARIO", 'WHERE c."tenantId" = $1'],
    ["ARRENDADOR", 'WHERE c."landlordId" = $1'],
  ] as const)("uses the historical contract visibility for %s", async (role, where) => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new ContractRenewalsRepository({ query }).listForSession(role, "user-1");
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(where);
    expect(sql).toContain('ORDER BY r."createdAt" DESC');
    expect(sql).toContain("JOIN public.contracts c ON c.id = r.\"contractId\"");
    expect(sql).toContain("JOIN public.properties p ON p.id = c.\"propertyId\"");
    expect(sql).toContain('r."proposedEndDate" AT TIME ZONE \'UTC\'');
    expect(sql).toContain('c."startDate" AT TIME ZONE \'UTC\' AS "contractStartDate"');
    expect(sql).not.toContain("passwordHash");
    expect(sql).not.toContain("users.*");
    expect(values).toEqual(["user-1"]);
  });
});
