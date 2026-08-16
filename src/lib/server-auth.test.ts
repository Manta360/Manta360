import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findActiveSessionUserById: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/repositories/session-user.server", () => ({
  sessionUserRepository: { findActiveSessionUserById: mocks.findActiveSessionUserById },
}));

import { getActiveSession } from "@/lib/server-auth";

const tenantSession = { sub: "tenant-1", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" as const };

describe("getActiveSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null without a cookie or for an invalid JWT represented by getSession null", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(getActiveSession()).resolves.toBeNull();
    expect(mocks.findActiveSessionUserById).not.toHaveBeenCalled();
  });

  it("rejects an otherwise valid session when its user no longer exists", async () => {
    mocks.getSession.mockResolvedValue(tenantSession);
    mocks.findActiveSessionUserById.mockResolvedValue(null);
    await expect(getActiveSession()).resolves.toBeNull();
  });

  it("preserves revocation by rejecting inactive users", async () => {
    mocks.getSession.mockResolvedValue(tenantSession);
    mocks.findActiveSessionUserById.mockResolvedValue({ id: tenantSession.sub, active: false });
    await expect(getActiveSession()).resolves.toBeNull();
  });

  it.each([
    "MUNICIPIO",
    "ARRENDADOR",
    "ARRENDATARIO",
  ] as const)("preserves the active %s JWT payload without loading sensitive fields", async (role) => {
    const session = { ...tenantSession, role };
    mocks.getSession.mockResolvedValue(session);
    mocks.findActiveSessionUserById.mockResolvedValue({ id: session.sub, active: true });

    await expect(getActiveSession()).resolves.toBe(session);
    expect(mocks.findActiveSessionUserById).toHaveBeenCalledWith(session.sub);
    expect(JSON.stringify(session)).not.toContain("passwordHash");
  });

  it("preserves the previous database-error propagation behavior", async () => {
    mocks.getSession.mockResolvedValue(tenantSession);
    mocks.findActiveSessionUserById.mockRejectedValue(new Error("database lookup failed"));
    await expect(getActiveSession()).rejects.toThrow("database lookup failed");
  });
});
