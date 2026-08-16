import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/contracts.server", () => ({ contractsRepository: { findById: vi.fn() } }));

import { GET } from "@/app/api/contracts/[id]/pdf/route";
import { getActiveSession } from "@/lib/server-auth";
import { contractsRepository } from "@/repositories/contracts.server";

const session = vi.mocked(getActiveSession);
const repository = vi.mocked(contractsRepository);
const contract = {
  id: "contract-1", tenantId: "tenant-1", landlordId: "landlord-1", status: "ACTIVO",
  startDate: new Date("2026-01-01T00:00:00Z"), endDate: new Date("2026-12-31T00:00:00Z"), monthlyRent: "500.00", purpose: "Vivienda", paymentMethod: "Transferencia",
  properties: { title: "Casa central", address: "Av. 1 y Calle 2" },
  users_contracts_landlordIdTousers: { fullName: "Arrendador Seguro", nationalId: "1111111111" },
  users_contracts_tenantIdTousers: { fullName: "Arrendatario Seguro", nationalId: "2222222222" },
};

function context(id = "contract-1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => { vi.clearAllMocks(); repository.findById.mockResolvedValue(contract as never); });

describe("KAN-49 - exportacion PDF contractual", () => {
  it("returns 401 without a session", async () => {
    session.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context())).status).toBe(401);
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it.each([
    ["tenant participante", { sub: "tenant-1", role: "ARRENDATARIO" as const }, 200],
    ["landlord participante", { sub: "landlord-1", role: "ARRENDADOR" as const }, 200],
    ["municipio", { sub: "municipio-1", role: "MUNICIPIO" as const }, 200],
    ["tenant ajeno", { sub: "other-tenant", role: "ARRENDATARIO" as const }, 404],
    ["landlord ajeno", { sub: "other-landlord", role: "ARRENDADOR" as const }, 404],
  ])("preserves access for %s", async (_label, actor, expected) => {
    session.mockResolvedValue({ ...actor, email: "user@test", fullName: "User" });
    const response = await GET(new Request("http://localhost"), context());
    expect(response.status).toBe(expected);
    expect(repository.findById).toHaveBeenCalledWith("contract-1");
  });

  it("returns the historical PDF response and contractual content", async () => {
    session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" });
    const response = await GET(new Request("http://localhost/api/contracts/contract-1/pdf"), context());
    const content = new TextDecoder().decode(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="contrato-contract-1.pdf"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content.length).toBeGreaterThan(500);
    expect(content).toContain("Contrato No. contract-1");
    expect(content).toContain("Casa central");
    expect(content).toContain("Arrendador Seguro");
    expect(content).toContain("Arrendatario Seguro");
    expect(content).toContain("$500,00");
    expect(content).not.toContain("passwordHash");
    expect(content).not.toContain("tenant@test");
  });

  it("returns 404 for a missing contract", async () => {
    session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" });
    repository.findById.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context("missing"))).status).toBe(404);
  });
});
