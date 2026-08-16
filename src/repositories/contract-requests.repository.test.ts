import { describe, expect, it, vi } from "vitest";
import { ContractRequestsRepository } from "@/repositories/contract-requests.repository";

describe("ContractRequestsRepository", () => {
  it.each([
    ["ARRENDATARIO", 'WHERE r."tenantId" = $1'],
    ["ARRENDADOR", 'WHERE p."landlordId" = $1'],
    ["MUNICIPIO", ""],
  ])("uses the historical visibility query for %s", async (role, expectedWhere) => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new ContractRequestsRepository({ query }).listForSession(role, "user-1");
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).toContain(expectedWhere);
    expect(query.mock.calls[0][0]).toContain('ORDER BY r."createdAt" DESC');
    expect(query.mock.calls[0][1]).toEqual(expectedWhere ? ["user-1"] : []);
  });

  it("projects only the historical user fields", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new ContractRequestsRepository({ query }).listForSession("MUNICIPIO", "municipio");
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("'nationalId', u.\"nationalId\"");
    expect(sql).not.toContain("passwordHash");
    expect(sql).not.toContain("users.*");
  });
});
