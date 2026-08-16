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
});
