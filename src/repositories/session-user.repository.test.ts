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
});
