import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveSession: vi.fn(),
  findUserById: vi.fn(),
  getLandlordCounts: vi.fn(),
  getTenantCounts: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({ getActiveSession: mocks.getActiveSession }));
vi.mock("@/repositories/dashboard.server", () => ({
  dashboardRepository: {
    findUserById: mocks.findUserById,
    getLandlordCounts: mocks.getLandlordCounts,
    getTenantCounts: mocks.getTenantCounts,
  },
}));

import { GET } from "@/app/api/my-dashboard/route";

const user = { fullName: "Usuario", email: "user@example.test", phone: null, nationalId: null };
const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

describe("GET /api/my-dashboard migrated to PostgreSQL repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUserById.mockResolvedValue(user);
    mocks.getLandlordCounts.mockResolvedValue({ properties: 0, conversations: 0, documents: 0 });
    mocks.getTenantCounts.mockResolvedValue({ requests: 0, conversations: 0, documents: 0 });
  });

  it("conserva 401 sin sesión y 404 para usuario ausente", async () => {
    mocks.getActiveSession.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(401);

    mocks.getActiveSession.mockResolvedValueOnce({ sub: "missing", email: "missing@example.test", fullName: "Missing", role: "ARRENDATARIO" });
    mocks.findUserById.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(404);
  });

  it("conserva cards y números del arrendador", async () => {
    mocks.getActiveSession.mockResolvedValue({ sub: "landlord-1", email: "landlord@example.test", fullName: "Landlord", role: "ARRENDADOR" });
    mocks.getLandlordCounts.mockResolvedValue({ properties: 2, conversations: 3, documents: 1 });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user, role: "ARRENDADOR", cards: [{ label: "Mis propiedades", value: 2 }, { label: "Mis conversaciones", value: 3 }, { label: "Documentos verificados", value: 1 }] });
    expect(mocks.getLandlordCounts).toHaveBeenCalledWith("landlord-1");
  });

  it("conserva cards, ceros y ownership del arrendatario", async () => {
    mocks.getActiveSession.mockResolvedValue({ sub: "tenant-1", email: "tenant@example.test", fullName: "Tenant", role: "ARRENDATARIO" });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user, role: "ARRENDATARIO", cards: [{ label: "Mis solicitudes", value: 0 }, { label: "Mis conversaciones", value: 0 }, { label: "Documentos verificados", value: 0 }] });
    expect(mocks.getTenantCounts).toHaveBeenCalledWith("tenant-1");
    expect(mocks.getTenantCounts).not.toHaveBeenCalledWith("other-user");
  });

  it("conserva Municipio sin cards y oculta errores PostgreSQL", async () => {
    mocks.getActiveSession.mockResolvedValue({ sub: "municipio-1", email: "municipio@example.test", fullName: "Municipio", role: "MUNICIPIO" });
    await expect((await GET()).json()).resolves.toEqual({ user, role: "MUNICIPIO", cards: [] });

    mocks.getActiveSession.mockResolvedValue({ sub: "tenant-1", email: "tenant@example.test", fullName: "Tenant", role: "ARRENDATARIO" });
    mocks.getTenantCounts.mockRejectedValueOnce(new Error("SELECT password FROM users"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("SELECT password");
    expect(consoleError).toHaveBeenCalled();
  });
});
