import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  listUsers: vi.fn(), listLandlords: vi.fn(), findLandlordById: vi.fn(), findManagedUserById: vi.fn(), createLandlord: vi.fn(), updateLandlord: vi.fn(),
}));
vi.mock("@/lib/server-auth", () => ({ getActiveSession: mocks.session }));
vi.mock("@/repositories/admin-users.server", () => ({ adminUsersRepository: {
  listUsers: mocks.listUsers, listLandlords: mocks.listLandlords, findLandlordById: mocks.findLandlordById,
  findManagedUserById: mocks.findManagedUserById, createLandlord: mocks.createLandlord, updateLandlord: mocks.updateLandlord,
} }));

import { GET as listUsers, POST as createLandlord } from "@/app/api/admin/users/route";
import { PATCH as updateLandlord } from "@/app/api/admin/users/[id]/route";

const landlord = { id: "landlord-1", fullName: "Landlord Uno", email: "landlord@test.com", phone: null, nationalId: null, role: "ARRENDADOR", active: true, disabledAt: null, disabledBy: null, disableReason: null, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") };

describe("KAN-39 - gestión administrativa de arrendadores PostgreSQL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ sub: "municipio-1", role: "MUNICIPIO", email: "m@test.com", fullName: "Municipio" });
    mocks.findLandlordById.mockResolvedValue(landlord);
    mocks.listUsers.mockResolvedValue([landlord]);
    mocks.updateLandlord.mockResolvedValue({ ...landlord, fullName: "Landlord Actualizado", updatedAt: new Date("2026-08-01") });
    mocks.createLandlord.mockResolvedValue(landlord);
  });

  it("rechaza acceso no municipal", async () => {
    mocks.session.mockResolvedValue({ sub: "tenant-1", role: "ARRENDATARIO", email: "t@test.com", fullName: "Tenant" });
    expect((await listUsers(new Request("http://localhost/api/admin/users"))).status).toBe(403);
  });

  it("crea exclusivamente un Arrendador sin exponer passwordHash", async () => {
    const response = await createLandlord(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: "Landlord Uno", email: "landlord@test.com", phone: "3001234567", nationalId: "1234567890", password: "Password123!", role: "MUNICIPIO" }) }));
    expect(response.status).toBe(201);
    expect(mocks.createLandlord).toHaveBeenCalledWith(expect.objectContaining({ email: "landlord@test.com", passwordHash: expect.any(String) }));
    expect(JSON.stringify(await response.json())).not.toContain("passwordHash");
  });

  it("edita el perfil por repository PostgreSQL", async () => {
    const response = await updateLandlord(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: "Landlord Actualizado" }) }), { params: Promise.resolve({ id: "landlord-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.updateLandlord).toHaveBeenCalledWith("landlord-1", { fullName: "Landlord Actualizado" });
  });

  it("mantiene los conflictos únicos como 409", async () => {
    mocks.updateLandlord.mockRejectedValue({ code: "23505" });
    const response = await updateLandlord(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "otro@test.com" }) }), { params: Promise.resolve({ id: "landlord-1" }) });
    expect(response.status).toBe(409);
  });
});
