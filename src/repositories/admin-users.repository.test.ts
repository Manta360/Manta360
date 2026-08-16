import { describe, expect, it, vi } from "vitest";
import { AdminUsersRepository } from "@/repositories/admin-users.repository";

describe("AdminUsersRepository", () => {
  it("lists only landlords in historical order with an explicit safe projection", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: "landlord-1", fullName: "Maria", email: "maria@test", phone: null, nationalId: null, role: "ARRENDADOR", active: true,
      disabledAt: null, disabledBy: null, disableReason: null, createdAt: new Date("2026-08-03T00:00:00.000Z"), updatedAt: new Date("2026-08-04T00:00:00.000Z"), propertiesCount: "2",
    }] });
    const landlords = await new AdminUsersRepository({ query }).listLandlords();
    expect(landlords[0]).toMatchObject({ id: "landlord-1", role: "ARRENDADOR", propertiesCount: 2, disabledAt: null });
    const [sql, values] = query.mock.calls[0] as [string, unknown[] | undefined];
    expect(sql).toContain("WHERE u.role = 'ARRENDADOR'::\"Role\"");
    expect(sql).toContain('ORDER BY u."createdAt" DESC');
    expect(sql).toContain('COUNT(p.id)::text AS "propertiesCount"');
    expect(sql).toContain('u."createdAt" AT TIME ZONE \'UTC\'');
    expect(sql).not.toContain("passwordHash");
    expect(sql).not.toContain("users.*");
    expect(values).toBeUndefined();
  });

  it("finds one landlord by parameterized id without exposing internal user fields", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: "landlord-1", fullName: "Maria", email: "maria@test", phone: null, nationalId: null, role: "ARRENDADOR", active: false,
      disabledAt: new Date("2026-08-01T00:00:00.000Z"), disabledBy: "municipio-1", disableReason: "Motivo", createdAt: new Date("2026-08-02T00:00:00.000Z"), updatedAt: new Date("2026-08-03T00:00:00.000Z"),
    }] });
    const repository = new AdminUsersRepository({ query });

    await expect(repository.findLandlordById("landlord-1")).resolves.toMatchObject({ id: "landlord-1", active: false, disabledBy: "municipio-1" });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE u.id = $1 AND u.role = 'ARRENDADOR'::\"Role\"");
    expect(sql).not.toContain("users.*");
    expect(sql).not.toContain("passwordHash");
    expect(values).toEqual(["landlord-1"]);
  });

  it("returns null for a missing user or a user with another role", async () => {
    const repository = new AdminUsersRepository({ query: vi.fn().mockResolvedValue({ rows: [] }) });
    await expect(repository.findLandlordById("tenant-1")).resolves.toBeNull();
  });
});
