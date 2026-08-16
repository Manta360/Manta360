import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findPublicSessionUserById: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/repositories/session-user.server", () => ({
  sessionUserRepository: { findPublicSessionUserById: mocks.findPublicSessionUserById },
}));

import { GET } from "@/app/api/auth/me/route";

const session = { sub: "user-1", email: "jwt@example.test", fullName: "JWT User", role: "ARRENDATARIO" as const };
const user = { id: "user-1", email: "user@example.test", fullName: "Database User", phone: null, nationalId: null, role: "ARRENDATARIO", active: true, createdAt: new Date("2026-08-16T12:00:00.000Z") };

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(session);
    mocks.findPublicSessionUserById.mockResolvedValue(user);
  });

  it("returns the historical 401 body without a valid session", async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ user: null });
    expect(mocks.findPublicSessionUserById).not.toHaveBeenCalled();
  });

  it.each([null, { ...user, active: false }] as const)("rejects missing and inactive users", async (currentUser) => {
    mocks.findPublicSessionUserById.mockResolvedValue(currentUser);
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ user: null });
  });

  it.each(["MUNICIPIO", "ARRENDADOR", "ARRENDATARIO"] as const)("returns the exact public response for active %s users", async (role) => {
    mocks.getSession.mockResolvedValue({ ...session, role });
    mocks.findPublicSessionUserById.mockResolvedValue({ ...user, role });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.findPublicSessionUserById).toHaveBeenCalledWith(session.sub);
    await expect(response.json()).resolves.toEqual({ user: { id: user.id, email: user.email, fullName: user.fullName, phone: null, nationalId: null, role, active: true, createdAt: "2026-08-16T12:00:00.000Z" } });
  });

  it("does not expose database details when PostgreSQL fails", async () => {
    mocks.findPublicSessionUserById.mockRejectedValueOnce(new Error("SELECT passwordHash FROM users at database-host"));
    const response = await GET();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ user: null });
  });
});
