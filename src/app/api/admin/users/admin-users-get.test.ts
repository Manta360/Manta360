import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/admin-users.server", () => ({ adminUsersRepository: { listLandlords: vi.fn() } }));

import { GET } from "@/app/api/admin/users/route";
import { getActiveSession } from "@/lib/server-auth";
import { adminUsersRepository } from "@/repositories/admin-users.server";

const session = vi.mocked(getActiveSession);
const repository = vi.mocked(adminUsersRepository);
const landlord = {
  id: "landlord-1", fullName: "Maria Arrendadora", email: "maria@test", phone: "099", nationalId: "1316551017", role: "ARRENDADOR", active: false,
  disabledAt: new Date("2026-08-02T00:00:00.000Z"), disabledBy: "municipio-1", disableReason: "Motivo", createdAt: new Date("2026-08-03T00:00:00.000Z"), updatedAt: new Date("2026-08-04T00:00:00.000Z"), propertiesCount: 2,
};

describe("GET /api/admin/users", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(() => undefined); repository.listLandlords.mockResolvedValue([landlord]); });

  it.each([
    ["sin sesion", null],
    ["arrendador", { sub: "landlord-2", email: "landlord@test", fullName: "Landlord", role: "ARRENDADOR" as const }],
    ["arrendatario", { sub: "tenant-1", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" as const }],
  ])("preserves historical denial for %s", async (_label, actor) => {
    session.mockResolvedValue(actor);
    const response = await GET();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Acceso exclusivo del Municipio" });
    expect(repository.listLandlords).not.toHaveBeenCalled();
  });

  it("returns the historical safe landlord projection", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test", fullName: "Municipio", role: "MUNICIPIO" });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      landlords: [{ ...landlord, disabledAt: landlord.disabledAt.toISOString(), createdAt: landlord.createdAt.toISOString(), updatedAt: landlord.updatedAt.toISOString() }],
    });
  });

  it("preserves the empty list", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test", fullName: "Municipio", role: "MUNICIPIO" });
    repository.listLandlords.mockResolvedValue([]);
    await expect((await GET()).json()).resolves.toEqual({ landlords: [] });
  });

  it("maps PostgreSQL failures without exposing internals", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test", fullName: "Municipio", role: "MUNICIPIO" });
    repository.listLandlords.mockRejectedValue(new Error("SELECT passwordHash FROM users at db.internal"));
    const response = await GET();
    expect(response.status).toBe(500);
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("SELECT");
    expect(body).not.toContain("passwordHash");
    expect(body).not.toContain("db.internal");
  });
});
