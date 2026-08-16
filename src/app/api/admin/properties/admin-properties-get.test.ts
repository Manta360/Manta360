import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/admin-properties.server", () => ({ adminPropertiesRepository: { listForMunicipality: vi.fn() } }));

import { GET } from "@/app/api/admin/properties/route";
import { getActiveSession } from "@/lib/server-auth";
import { adminPropertiesRepository } from "@/repositories/admin-properties.server";

const session = vi.mocked(getActiveSession);
const repository = vi.mocked(adminPropertiesRepository);
const result = {
  properties: [{
    id: "property-1", landlordId: "landlord-1", title: "Vista", address: "Manta", monthlyRent: 750.5, status: "OCUPADO",
    createdAt: new Date("2026-08-03T00:00:00.000Z"), updatedAt: new Date("2026-08-04T00:00:00.000Z"), description: null,
    bedrooms: null, bathrooms: null, latitude: null, longitude: null, createdBy: null, approved: false, approvedAt: null, approvedBy: null,
    disabledAt: null, disabledBy: null, disableReason: null,
    users_properties_landlordIdTousers: { id: "landlord-1", fullName: "Ana", email: "ana@test", phone: null, nationalId: "1316551017", active: true, disabledAt: null, disableReason: null },
  }],
  stats: { users: 4, pendingProperties: 1, occupiedProperties: 1, activeContracts: 1, disabledLandlords: 1, disabledProperties: 0 },
};

describe("GET /api/admin/properties", () => {
  beforeEach(() => { vi.clearAllMocks(); repository.listForMunicipality.mockResolvedValue(result); });

  it.each([
    ["sin sesion", null],
    ["arrendador", { sub: "landlord-2", email: "landlord@test", fullName: "Landlord", role: "ARRENDADOR" as const }],
    ["arrendatario", { sub: "tenant-1", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" as const }],
  ])("preserves 403 for %s", async (_label, actor) => {
    session.mockResolvedValue(actor);
    const response = await GET();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Acceso exclusivo del Municipio" });
    expect(repository.listForMunicipality).not.toHaveBeenCalled();
  });

  it("returns the historical property, landlord and six-counter response", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test", fullName: "Municipio", role: "MUNICIPIO" });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.properties[0].monthlyRent).toBe(750.5);
    expect(typeof body.properties[0].monthlyRent).toBe("number");
    expect(body.properties[0].users_properties_landlordIdTousers).toEqual(result.properties[0].users_properties_landlordIdTousers);
    expect(body.stats).toEqual(result.stats);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("keeps an empty list and six numeric zero counters", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test", fullName: "Municipio", role: "MUNICIPIO" });
    repository.listForMunicipality.mockResolvedValue({ properties: [], stats: { users: 0, pendingProperties: 0, occupiedProperties: 0, activeContracts: 0, disabledLandlords: 0, disabledProperties: 0 } });
    await expect((await GET()).json()).resolves.toEqual({ properties: [], stats: { users: 0, pendingProperties: 0, occupiedProperties: 0, activeContracts: 0, disabledLandlords: 0, disabledProperties: 0 } });
  });
});
