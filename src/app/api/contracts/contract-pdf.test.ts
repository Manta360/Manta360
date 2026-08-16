import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { contracts: { findUnique: vi.fn() } } }));

import { GET } from "@/app/api/contracts/[id]/pdf/route";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

const session = vi.mocked(getActiveSession);
const db = prisma as unknown as { contracts: { findUnique: ReturnType<typeof vi.fn> } };
const contract = {
  id: "contract-1", tenantId: "tenant-1", landlordId: "landlord-1", status: "ACTIVO",
  startDate: new Date("2026-01-01T00:00:00Z"), endDate: new Date("2026-12-31T00:00:00Z"), monthlyRent: 500, purpose: "Vivienda", paymentMethod: "Transferencia",
  properties: { title: "Casa central", address: "Av. 1 y Calle 2" },
  users_contracts_landlordIdTousers: { fullName: "Arrendador Seguro", nationalId: "1111111111" },
  users_contracts_tenantIdTousers: { fullName: "Arrendatario Seguro", nationalId: "2222222222" },
};
const context = { params: Promise.resolve({ id: "contract-1" }) };

describe("KAN-49 - exportacion PDF contractual", () => {
  beforeEach(() => { vi.clearAllMocks(); db.contracts.findUnique.mockResolvedValue(contract); });

  it("entrega un PDF real y descargable a una parte autorizada sin datos sensibles", async () => {
    session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test.com", fullName: "Tenant", role: "ARRENDATARIO" });
    const response = await GET(new Request("http://localhost/api/contracts/contract-1/pdf"), context);
    const content = new TextDecoder().decode(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("contrato-contract-1.pdf");
    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content.length).toBeGreaterThan(500);
    expect(content).toContain("Contrato No. contract-1");
    expect(content).not.toContain("passwordHash");
    expect(content).not.toContain("tenant@test.com");
  });

  it("autoriza al Municipio y rechaza a un usuario ajeno", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "m@test.com", fullName: "Municipio", role: "MUNICIPIO" });
    await expect(GET(new Request("http://localhost"), context)).resolves.toHaveProperty("status", 200);
    session.mockResolvedValue({ sub: "other-tenant", email: "other@test.com", fullName: "Other", role: "ARRENDATARIO" });
    await expect(GET(new Request("http://localhost"), context)).resolves.toHaveProperty("status", 404);
  });

  it("devuelve 404 cuando no existe el contrato", async () => {
    session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test.com", fullName: "Tenant", role: "ARRENDATARIO" });
    db.contracts.findUnique.mockResolvedValue(null);
    await expect(GET(new Request("http://localhost"), context)).resolves.toHaveProperty("status", 404);
  });
});
