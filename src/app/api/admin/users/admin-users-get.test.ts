import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/admin-users.server", () => ({
  adminUsersRepository: { listUsers: vi.fn(), listLandlords: vi.fn() },
}));

import { GET } from "@/app/api/admin/users/route";
import { getActiveSession } from "@/lib/server-auth";
import { adminUsersRepository } from "@/repositories/admin-users.server";

const session = vi.mocked(getActiveSession);
const repository = vi.mocked(adminUsersRepository);
const landlord = {
  id: "landlord-1",
  fullName: "Maria Arrendadora",
  email: "maria@test",
  phone: "099",
  nationalId: "1316551017",
  role: "ARRENDADOR",
  active: false,
  disabledAt: new Date("2026-08-02T00:00:00.000Z"),
  disabledBy: "municipio-1",
  disableReason: "Motivo",
  createdAt: new Date("2026-08-03T00:00:00.000Z"),
  updatedAt: new Date("2026-08-04T00:00:00.000Z"),
  propertiesCount: 2,
};
const tenant = {
  id: "tenant-1",
  fullName: "Pedro Arrendatario",
  email: "pedro@test",
  phone: "098",
  nationalId: "1316551018",
  role: "ARRENDATARIO",
  active: true,
  disabledAt: null,
  disabledBy: null,
  disableReason: null,
  createdAt: new Date("2026-08-05T00:00:00.000Z"),
  updatedAt: new Date("2026-08-06T00:00:00.000Z"),
  propertiesCount: 0,
};

const municipio = { sub: "municipio-1", email: "municipio@test", fullName: "Municipio", role: "MUNICIPIO" as const };

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    repository.listUsers.mockResolvedValue([landlord, tenant]);
  });

  it.each([
    ["sin sesion", null],
    ["arrendador", { sub: "landlord-2", email: "landlord@test", fullName: "Landlord", role: "ARRENDADOR" as const }],
    ["arrendatario", { sub: "tenant-1", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" as const }],
  ])("rechaza acceso para %s", async (_label, actor) => {
    session.mockResolvedValue(actor);
    const response = await GET(new Request("http://localhost/api/admin/users"));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Acceso exclusivo del Municipio" });
    expect(repository.listUsers).not.toHaveBeenCalled();
  });

  it("lista arrendadores y arrendatarios sin passwordHash", async () => {
    session.mockResolvedValue(municipio);
    const response = await GET(new Request("http://localhost/api/admin/users"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users).toHaveLength(2);
    expect(body.landlords).toHaveLength(1);
    expect(body.users[0]).toMatchObject({ id: "landlord-1", role: "ARRENDADOR", propertiesCount: 2 });
    expect(body.users[1]).toMatchObject({ id: "tenant-1", role: "ARRENDATARIO" });
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(repository.listUsers).toHaveBeenCalledWith({ role: null, search: null });
  });

  it("filtra por rol y búsqueda parcial", async () => {
    session.mockResolvedValue(municipio);
    repository.listUsers.mockResolvedValue([tenant]);
    const response = await GET(new Request("http://localhost/api/admin/users?role=ARRENDATARIO&search=pedro"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      users: [{ id: "tenant-1", role: "ARRENDATARIO" }],
      landlords: [],
    });
    expect(repository.listUsers).toHaveBeenCalledWith({ role: "ARRENDATARIO", search: "pedro" });
  });

  it("rechaza un filtro de rol inválido", async () => {
    session.mockResolvedValue(municipio);
    const response = await GET(new Request("http://localhost/api/admin/users?role=MUNICIPIO"));
    expect(response.status).toBe(400);
    expect(repository.listUsers).not.toHaveBeenCalled();
  });

  it("preserva la lista vacía", async () => {
    session.mockResolvedValue(municipio);
    repository.listUsers.mockResolvedValue([]);
    await expect((await GET(new Request("http://localhost/api/admin/users"))).json()).resolves.toEqual({ users: [], landlords: [] });
  });

  it("mapea fallos PostgreSQL sin exponer internos", async () => {
    session.mockResolvedValue(municipio);
    repository.listUsers.mockRejectedValue(new Error("SELECT passwordHash FROM users at db.internal"));
    const response = await GET(new Request("http://localhost/api/admin/users"));
    expect(response.status).toBe(500);
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("SELECT");
    expect(body).not.toContain("passwordHash");
    expect(body).not.toContain("db.internal");
  });
});
