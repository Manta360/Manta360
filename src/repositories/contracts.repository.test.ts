import { describe, expect, it, vi } from "vitest";
import { ContractsRepository } from "@/repositories/contracts.repository";

describe("ContractsRepository", () => {
  it.each([
    ["ARRENDATARIO", 'WHERE c."tenantId" = $1'],
    ["ARRENDADOR", 'WHERE c."landlordId" = $1'],
    ["MUNICIPIO", ""],
  ])("uses the historical visibility for %s", async (role, expectedWhere) => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new ContractsRepository({ query }).listForSession(role, "user-1");
    expect(query.mock.calls[0][0]).toContain(expectedWhere);
    expect(query.mock.calls[0][0]).toContain('ORDER BY c."createdAt" DESC');
    expect(query.mock.calls[0][1]).toEqual(expectedWhere ? ["user-1"] : []);
  });

  it("uses a strict expiration condition and excludes password hashes", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new ContractsRepository({ query });
    await repository.reconcileExpiredContracts(new Date("2026-08-16T00:00:00.000Z"));
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('"endDate" < $1');
    expect(sql).not.toContain("passwordHash");
  });

  it("finds a detail by its parameterized ID with the full historical property projection", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new ContractsRepository({ query }).findById("contract-1");
    const sql = query.mock.calls[0][0] as string;
    expect(query.mock.calls[0][1]).toEqual(["contract-1"]);
    expect(sql).toContain("WHERE c.id = $1");
    expect(sql).toContain('p."disableReason" AS "detailPropertyDisableReason"');
    expect(sql).toContain("'nationalId', tenant.\"nationalId\"");
    expect(sql).not.toContain("passwordHash");
    expect(sql).not.toContain("users.*");
  });
});
