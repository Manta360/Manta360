import { describe, expect, it, vi } from "vitest";
import { DashboardRepository, type DashboardSqlExecutor } from "@/repositories/dashboard.repository";

describe("DashboardRepository", () => {
  it("conserva el usuario público, sus nulls y el filtro parametrizado", async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ fullName: "Tenant", email: "tenant@example.test", phone: null, nationalId: null }] }) } as unknown as DashboardSqlExecutor;
    const repository = new DashboardRepository(executor);

    await expect(repository.findUserById("tenant-1")).resolves.toEqual({ fullName: "Tenant", email: "tenant@example.test", phone: null, nationalId: null });
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining("WHERE id = $1"), ["tenant-1"]);
  });

  it("normaliza COUNT bigint a números para arrendador y conserva todos los filtros", async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ properties: "2", conversations: "3", documents: "1" }] }) } as unknown as DashboardSqlExecutor;
    const repository = new DashboardRepository(executor);

    await expect(repository.getLandlordCounts("landlord-1")).resolves.toEqual({ properties: 2, conversations: 3, documents: 1 });
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('"landlordId" = $1'), ["landlord-1"]);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('"verificationStatus" = \'VERIFICADO\''), ["landlord-1"]);
  });

  it("devuelve ceros numéricos para arrendatario sin datos", async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ requests: "0", conversations: "0", documents: "0" }] }) } as unknown as DashboardSqlExecutor;
    const repository = new DashboardRepository(executor);

    await expect(repository.getTenantCounts("tenant-1")).resolves.toEqual({ requests: 0, conversations: 0, documents: 0 });
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('"tenantId" = $1'), ["tenant-1"]);
  });
});
