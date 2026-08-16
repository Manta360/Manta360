import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/admin-stats.server", () => ({ adminStatsRepository: { getStatistics: vi.fn() } }));

import { GET } from "@/app/api/admin/stats/route";
import { getActiveSession } from "@/lib/server-auth";
import { adminStatsRepository } from "@/repositories/admin-stats.server";

const session = vi.mocked(getActiveSession);
const repository = vi.mocked(adminStatsRepository);
const statistics = {
  propertiesByZone: [{ zone: "Tarqui", count: 2 }, { zone: "Centro", count: 1 }, { zone: "Zona no clasificada", count: 1 }],
  averageRentByZone: [{ zone: "Tarqui", averageRent: 200 }, { zone: "Centro", averageRent: 250 }, { zone: "Zona no clasificada", averageRent: 500 }],
  incidentsByStatus: { PENDIENTE: 3, EN_PROCESO: 0, RESUELTO: 1 },
  topLandlords: [{ id: "l-1", fullName: "Ana", active: true, propertiesCount: 7 }, { id: "l-2", fullName: "Bea", active: false, propertiesCount: 7 }],
};

describe("GET /api/admin/stats", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(() => undefined); repository.getStatistics.mockResolvedValue(statistics); });

  it.each([
    ["sin sesion", null],
    ["arrendador", { sub: "landlord-1", email: "landlord@test", role: "ARRENDADOR" as const, fullName: "Landlord" }],
    ["arrendatario", { sub: "tenant-1", email: "tenant@test", role: "ARRENDATARIO" as const, fullName: "Tenant" }],
  ])("rejects %s before querying data", async (_label, actor) => {
    session.mockResolvedValue(actor);
    const response = await GET();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Acceso exclusivo del Municipio" });
    expect(repository.getStatistics).not.toHaveBeenCalled();
  });

  it("returns the historical municipal statistics shape and number values", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test", role: "MUNICIPIO", fullName: "Municipio de Manta" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(repository.getStatistics).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual(statistics);
  });

  it("maps PostgreSQL failures without exposing internals", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test", role: "MUNICIPIO", fullName: "Municipio de Manta" });
    repository.getStatistics.mockRejectedValue(new Error("SELECT passwordHash FROM users at db.internal"));
    const response = await GET();
    expect(response.status).toBe(500);
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("SELECT");
    expect(body).not.toContain("passwordHash");
    expect(body).not.toContain("db.internal");
  });
});
