import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({
  getActiveSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contracts: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/contracts/[id]/route";
import { getActiveSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

const mockedSession = vi.mocked(getActiveSession);
const mockedPrisma = prisma as unknown as {
  contracts: { findUnique: ReturnType<typeof vi.fn> };
};

const contract = {
  id: "contract-1",
  tenantId: "tenant-1",
  landlordId: "landlord-1",
  status: "PENDIENTE_FIRMA",
  properties: { id: "property-1", title: "Departamento", address: "Manta" },
  users_contracts_tenantIdTousers: {
    id: "tenant-1",
    fullName: "Teresa Arrendataria",
    email: "teresa@example.com",
    phone: "0999999999",
    nationalId: "1316551017",
    passwordHash: "tenant-secret-hash",
    disabledAt: null,
  },
  users_contracts_landlordIdTousers: {
    id: "landlord-1",
    fullName: "Luis Arrendador",
    email: "luis@example.com",
    phone: "0988888888",
    nationalId: "1316551018",
    passwordHash: "landlord-secret-hash",
    disableReason: "internal-only",
  },
};

const publicTenant = {
  id: "tenant-1",
  fullName: "Teresa Arrendataria",
  email: "teresa@example.com",
  phone: "0999999999",
  nationalId: "1316551017",
};

const publicLandlord = {
  id: "landlord-1",
  fullName: "Luis Arrendador",
  email: "luis@example.com",
  phone: "0988888888",
  nationalId: "1316551018",
};

describe("KAN-42 - detalle de contratos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPrisma.contracts.findUnique.mockResolvedValue(contract as never);
  });

  it.each([
    ["arrendatario", { sub: "tenant-1", role: "ARRENDATARIO" as const }],
    ["arrendador", { sub: "landlord-1", role: "ARRENDADOR" as const }],
    ["municipio", { sub: "municipio-1", role: "MUNICIPIO" as const }],
  ])("devuelve los campos permitidos sin hashes para %s", async (_role, session) => {
    mockedSession.mockResolvedValue({ ...session, email: "user@example.com", fullName: "Usuario" });

    const response = await GET(new Request("http://localhost/api/contracts/contract-1"), {
      params: Promise.resolve({ id: "contract-1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.contract.users_contracts_tenantIdTousers).toEqual(publicTenant);
    expect(data.contract.users_contracts_landlordIdTousers).toEqual(publicLandlord);
    expect(JSON.stringify(data.contract)).not.toContain("passwordHash");
    expect(JSON.stringify(data.contract)).not.toContain("internal-only");
    expect(mockedPrisma.contracts.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        users_contracts_tenantIdTousers: { select: expect.objectContaining({ id: true, fullName: true, email: true, phone: true, nationalId: true }) },
        users_contracts_landlordIdTousers: { select: expect.objectContaining({ id: true, fullName: true, email: true, phone: true, nationalId: true }) },
      }),
    }));
  });

  it("mantiene la autorización y oculta contratos ajenos", async () => {
    mockedSession.mockResolvedValue({
      sub: "other-tenant",
      email: "other@example.com",
      role: "ARRENDATARIO",
      fullName: "Otro usuario",
    });

    const response = await GET(new Request("http://localhost/api/contracts/contract-1"), {
      params: Promise.resolve({ id: "contract-1" }),
    });

    expect(response.status).toBe(404);
  });
});
