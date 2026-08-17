import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/admin-users.server", () => ({
  adminUsersRepository: { findManagedUserById: vi.fn(), findLandlordById: vi.fn() },
}));

import { GET } from "@/app/api/admin/users/[id]/route";
import { getActiveSession } from "@/lib/server-auth";
import { adminUsersRepository } from "@/repositories/admin-users.server";

const session = vi.mocked(getActiveSession);
const repository = vi.mocked(adminUsersRepository);
const landlord = {
  id: "landlord-1",
  fullName: "Maria",
  email: "maria@test",
  phone: null,
  nationalId: "1316551017",
  role: "ARRENDADOR",
  active: false,
  disabledAt: new Date("2026-08-01T00:00:00.000Z"),
  disabledBy: "municipio-1",
  disableReason: "Motivo",
  createdAt: new Date("2026-08-02T00:00:00.000Z"),
  updatedAt: new Date("2026-08-03T00:00:00.000Z"),
};
const tenant = {
  id: "tenant-1",
  fullName: "Pedro",
  email: "pedro@test",
  phone: "099",
  nationalId: "1316551018",
  role: "ARRENDATARIO",
  active: true,
  disabledAt: null,
  disabledBy: null,
  disableReason: null,
  createdAt: new Date("2026-08-04T00:00:00.000Z"),
  updatedAt: new Date("2026-08-05T00:00:00.000Z"),
};

describe("GET /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.findManagedUserById.mockResolvedValue(landlord);
  });

  it.each([
    ["sin sesion", null],
    ["arrendador", { sub: "landlord-2", email: "landlord@test", fullName: "Landlord", role: "ARRENDADOR" as const }],
    ["arrendatario", { sub: "tenant-1", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" as const }],
  ])("preserves 403 for %s", async (_label, actor) => {
    session.mockResolvedValue(actor);
    const response = await GET(new Request("http://localhost/api/admin/users/landlord-1"), { params: Promise.resolve({ id: "landlord-1" }) });
    expect(response.status).toBe(403);
    expect(repository.findManagedUserById).not.toHaveBeenCalled();
  });

  it("returns landlord detail without passwordHash", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test", fullName: "Municipio", role: "MUNICIPIO" });
    const response = await GET(new Request("http://localhost/api/admin/users/landlord-1"), { params: Promise.resolve({ id: "landlord-1" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toEqual({
      ...landlord,
      createdAt: landlord.createdAt.toISOString(),
      updatedAt: landlord.updatedAt.toISOString(),
      disabledAt: landlord.disabledAt.toISOString(),
    });
    expect(body.landlord).toEqual(body.user);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(repository.findManagedUserById).toHaveBeenCalledWith("landlord-1");
  });

  it("returns tenant detail without inventing landlord write actions", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test", fullName: "Municipio", role: "MUNICIPIO" });
    repository.findManagedUserById.mockResolvedValue(tenant);
    const response = await GET(new Request("http://localhost/api/admin/users/tenant-1"), { params: Promise.resolve({ id: "tenant-1" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toMatchObject({ id: "tenant-1", role: "ARRENDATARIO", email: "pedro@test" });
    expect(body.landlord).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("returns 404 for a missing user", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test", fullName: "Municipio", role: "MUNICIPIO" });
    repository.findManagedUserById.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/admin/users/missing"), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Usuario no encontrado" });
  });
});
