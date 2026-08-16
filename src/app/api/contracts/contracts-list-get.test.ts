import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/contracts.server", () => ({
  contractsRepository: { listForSession: vi.fn() },
  reconcileExpiredContractsWithPostgres: vi.fn(),
  isPostgresContractTransactionConflict: vi.fn(),
}));

import { getActiveSession } from "@/lib/server-auth";
import { contractsRepository, isPostgresContractTransactionConflict, reconcileExpiredContractsWithPostgres } from "@/repositories/contracts.server";
import { GET } from "@/app/api/contracts/route";

const session = vi.mocked(getActiveSession);
const repository = vi.mocked(contractsRepository);
const reconcile = vi.mocked(reconcileExpiredContractsWithPostgres);
const conflict = vi.mocked(isPostgresContractTransactionConflict);

const contract = {
  id: "contract-1", propertyId: "property-1", tenantId: "tenant-1", landlordId: "landlord-1", status: "ACTIVO",
  startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date("2026-12-31T00:00:00.000Z"), monthlyRent: "650.00", depositAmount: null,
  city: null, province: null, canton: null, parish: null, neighborhood: null, street: null, houseNumber: null, intersection: null, purpose: null, paymentMethod: null,
  landlordSignedAt: null, tenantSignedAt: null, municipalReviewedAt: null, municipalReviewedBy: null, municipalReviewNotes: null, endedAt: null, endedBy: null,
  createdAt: new Date("2026-01-03T00:00:00.000Z"), updatedAt: new Date("2026-01-03T00:00:00.000Z"),
  properties: { id: "property-1", title: "Casa", address: "Manta" },
  users_contracts_tenantIdTousers: { id: "tenant-1", fullName: "Tenant", email: "tenant@test", phone: null, nationalId: "0101" },
  users_contracts_landlordIdTousers: { id: "landlord-1", fullName: "Landlord", email: "landlord@test", phone: null, nationalId: "0202" },
};

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" });
  reconcile.mockResolvedValue(0);
  conflict.mockReturnValue(false);
  repository.listForSession.mockResolvedValue([contract]);
});

describe("GET /api/contracts", () => {
  it("returns 401 before lifecycle without a session", async () => {
    session.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it.each(["ARRENDATARIO", "ARRENDADOR", "MUNICIPIO"] as const)("reconciles and preserves %s visibility", async (role) => {
    session.mockResolvedValue({ sub: "current-user", email: "user@test", fullName: "User", role });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(reconcile).toHaveBeenCalledOnce();
    expect(repository.listForSession).toHaveBeenCalledWith(role, "current-user");
  });

  it("preserves decimal conversion, dates, nulls, nested users, and safe fields", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.contracts[0]).toMatchObject({
      id: "contract-1", monthlyRent: 650, depositAmount: null, endedAt: null, endedBy: null,
      properties: contract.properties,
      users_contracts_tenantIdTousers: contract.users_contracts_tenantIdTousers,
      users_contracts_landlordIdTousers: contract.users_contracts_landlordIdTousers,
    });
    expect(body.contracts[0].startDate).toBe("2026-01-01T00:00:00.000Z");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("maps lifecycle conflicts and generic errors without internals", async () => {
    reconcile.mockRejectedValueOnce({ code: "40001", message: "internal SQL" });
    conflict.mockReturnValueOnce(true);
    let response = await GET();
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("internal SQL");

    reconcile.mockRejectedValueOnce(new Error("SELECT secret FROM users"));
    response = await GET();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("SELECT secret");
  });
});
