import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { contracts: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock("@/repositories/contracts.server", () => ({ contractsRepository: { findById: vi.fn() } }));

import { GET } from "@/app/api/contracts/[id]/route";
import { getActiveSession } from "@/lib/server-auth";
import { contractsRepository } from "@/repositories/contracts.server";

const session = vi.mocked(getActiveSession);
const repository = vi.mocked(contractsRepository);

const property = {
  id: "property-1", landlordId: "landlord-1", title: "Departamento", address: "Manta", monthlyRent: "650.00", status: "OCUPADO",
  createdAt: new Date("2026-01-01T00:00:00.000Z"), updatedAt: new Date("2026-01-02T00:00:00.000Z"), description: null,
  bedrooms: 2, bathrooms: 1, latitude: "-0.95", longitude: "-80.73", createdBy: null, approved: true, approvedAt: null,
  approvedBy: null, disabledAt: null, disabledBy: null, disableReason: null,
};

const contract = {
  id: "contract-1", propertyId: "property-1", tenantId: "tenant-1", landlordId: "landlord-1", status: "PENDIENTE_FIRMA",
  startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date("2026-12-31T00:00:00.000Z"), monthlyRent: "650.00", depositAmount: "300.00",
  city: null, province: null, canton: null, parish: null, neighborhood: null, street: null, houseNumber: null, intersection: null, purpose: null, paymentMethod: null,
  landlordSignedAt: null, tenantSignedAt: null, municipalReviewedAt: null, municipalReviewedBy: null, municipalReviewNotes: null,
  endedAt: null, endedBy: null, createdAt: new Date("2026-01-03T00:00:00.000Z"), updatedAt: new Date("2026-01-03T00:00:00.000Z"),
  properties: property,
  users_contracts_tenantIdTousers: { id: "tenant-1", fullName: "Teresa", email: "tenant@test", phone: "099", nationalId: "0101" },
  users_contracts_landlordIdTousers: { id: "landlord-1", fullName: "Luis", email: "landlord@test", phone: "098", nationalId: "0202" },
};

function request(id = "contract-1") {
  return new Request(`http://localhost/api/contracts/${id}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test", fullName: "Teresa", role: "ARRENDATARIO" });
  repository.findById.mockResolvedValue(contract);
});

describe("KAN-42 - GET detalle de contratos", () => {
  it("returns 401 without a session", async () => {
    session.mockResolvedValue(null);
    expect((await GET(request(), { params: Promise.resolve({ id: "contract-1" }) })).status).toBe(401);
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it.each([
    ["arrendatario participante", { sub: "tenant-1", role: "ARRENDATARIO" as const }, 200],
    ["arrendador participante", { sub: "landlord-1", role: "ARRENDADOR" as const }, 200],
    ["municipio", { sub: "municipio-1", role: "MUNICIPIO" as const }, 200],
    ["arrendatario ajeno", { sub: "other-tenant", role: "ARRENDATARIO" as const }, 404],
    ["arrendador ajeno", { sub: "other-landlord", role: "ARRENDADOR" as const }, 404],
  ])("preserves access for %s", async (_label, actor, expected) => {
    session.mockResolvedValue({ ...actor, email: "user@test", fullName: "User" });
    const response = await GET(request(), { params: Promise.resolve({ id: "contract-1" }) });
    expect(response.status).toBe(expected);
    expect(repository.findById).toHaveBeenCalledWith("contract-1");
  });

  it("returns 404 for a non-existent contract", async () => {
    repository.findById.mockResolvedValue(null);
    expect((await GET(request("missing"), { params: Promise.resolve({ id: "missing" }) })).status).toBe(404);
  });

  it.each(["PENDIENTE_FIRMA", "PENDIENTE_MUNICIPIO", "ACTIVO", "RECHAZADO_MUNICIPIO", "FINALIZADO", "EN_RENOVACION"])("preserves status %s", async (status) => {
    repository.findById.mockResolvedValue({ ...contract, status });
    const response = await GET(request(), { params: Promise.resolve({ id: "contract-1" }) });
    expect((await response.json()).contract.status).toBe(status);
  });

  it("preserves the complete response shape and does not expose password hashes", async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: "contract-1" }) });
    const body = await response.json();
    expect(body.contract).toMatchObject({
      monthlyRent: "650.00", depositAmount: "300.00", endedAt: null, endedBy: null,
      properties: { monthlyRent: "650.00", status: "OCUPADO", bedrooms: 2, latitude: "-0.95" },
      users_contracts_tenantIdTousers: contract.users_contracts_tenantIdTousers,
      users_contracts_landlordIdTousers: contract.users_contracts_landlordIdTousers,
    });
    expect(body.contract.startDate).toBe("2026-01-01T00:00:00.000Z");
    expect(body.contract.properties.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });
});
