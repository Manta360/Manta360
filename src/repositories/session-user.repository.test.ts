import { describe, expect, it, vi } from "vitest";
import { SessionUserRepository } from "@/repositories/session-user.repository";

describe("SessionUserRepository", () => {
  it("looks up only the active-session projection with a parameterized id", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "user-1", active: true }] });
    const repository = new SessionUserRepository({ query });

    await expect(repository.findActiveSessionUserById("user-1")).resolves.toEqual({ id: "user-1", active: true });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE u.id = $1");
    expect(sql).toContain("SELECT u.id, u.active");
    expect(sql).not.toContain("users.*");
    expect(sql).not.toContain("passwordHash");
    expect(values).toEqual(["user-1"]);
  });

  it("returns null when the session user no longer exists", async () => {
    const repository = new SessionUserRepository({ query: vi.fn().mockResolvedValue({ rows: [] }) });
    await expect(repository.findActiveSessionUserById("missing")).resolves.toBeNull();
  });

  it("loads the exact public /auth/me projection with a parameterized id", async () => {
    const createdAt = new Date("2026-08-16T12:00:00.000Z");
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "user-1", email: "user@example.test", fullName: "User", phone: null, nationalId: null, role: "ARRENDATARIO", active: true, createdAt }] });
    const repository = new SessionUserRepository({ query });

    await expect(repository.findPublicSessionUserById("user-1")).resolves.toEqual({ id: "user-1", email: "user@example.test", fullName: "User", phone: null, nationalId: null, role: "ARRENDATARIO", active: true, createdAt });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE u.id = $1");
    expect(sql).toContain('u."createdAt" AT TIME ZONE');
    expect(sql).not.toContain("users.*");
    expect(sql).not.toContain("passwordHash");
    expect(values).toEqual(["user-1"]);
  });
});
