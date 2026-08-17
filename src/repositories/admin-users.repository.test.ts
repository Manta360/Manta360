import { describe, expect, it, vi } from "vitest";
import { AdminUsersRepository } from "@/repositories/admin-users.repository";

describe("AdminUsersRepository", () => {
  it("lista usuarios gestionables con proyección segura", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: "landlord-1",
        fullName: "Maria",
        email: "maria@test",
        phone: null,
        nationalId: null,
        role: "ARRENDADOR",
        active: true,
        disabledAt: null,
        disabledBy: null,
        disableReason: null,
        createdAt: new Date("2026-08-03T00:00:00.000Z"),
        updatedAt: new Date("2026-08-04T00:00:00.000Z"),
        propertiesCount: "2",
      }],
    });
    const users = await new AdminUsersRepository({ query }).listUsers();
    expect(users[0]).toMatchObject({ id: "landlord-1", role: "ARRENDADOR", propertiesCount: 2, disabledAt: null });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(`u.role IN ('ARRENDADOR'::"Role", 'ARRENDATARIO'::"Role")`);
    expect(sql).toContain('ORDER BY u."createdAt" DESC');
    expect(sql).toContain('COUNT(p.id)::text AS "propertiesCount"');
    expect(sql).not.toContain("passwordHash");
    expect(sql).not.toContain("users.*");
    expect(values).toEqual([]);
  });

  it("filtra por rol y búsqueda parcial parametrizada", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new AdminUsersRepository({ query }).listUsers({ role: "ARRENDATARIO", search: "pedro" });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('u.role = $1::"Role"');
    expect(sql).toContain(`u."fullName" ILIKE '%' || $2 || '%'`);
    expect(sql).toContain(`u.email ILIKE '%' || $2 || '%'`);
    expect(sql).toContain(`COALESCE(u."nationalId", '') ILIKE '%' || $2 || '%'`);
    expect(sql).not.toContain("passwordHash");
    expect(values).toEqual(["ARRENDATARIO", "pedro"]);
  });

  it("mantiene listLandlords como filtro de arrendadores", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new AdminUsersRepository({ query }).listLandlords();
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('u.role = $1::"Role"');
    expect(values).toEqual(["ARRENDADOR"]);
  });

  it("encuentra un usuario gestionable por id parametrizado", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: "tenant-1",
        fullName: "Pedro",
        email: "pedro@test",
        phone: null,
        nationalId: null,
        role: "ARRENDATARIO",
        active: true,
        disabledAt: null,
        disabledBy: null,
        disableReason: null,
        createdAt: new Date("2026-08-02T00:00:00.000Z"),
        updatedAt: new Date("2026-08-03T00:00:00.000Z"),
      }],
    });
    const repository = new AdminUsersRepository({ query });
    await expect(repository.findManagedUserById("tenant-1")).resolves.toMatchObject({ id: "tenant-1", role: "ARRENDATARIO" });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE u.id = $1 AND u.role IN ('ARRENDADOR'::\"Role\", 'ARRENDATARIO'::\"Role\")");
    expect(sql).not.toContain("passwordHash");
    expect(values).toEqual(["tenant-1"]);
  });

  it("encuentra un arrendador por id sin exponer campos internos", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: "landlord-1",
        fullName: "Maria",
        email: "maria@test",
        phone: null,
        nationalId: null,
        role: "ARRENDADOR",
        active: false,
        disabledAt: new Date("2026-08-01T00:00:00.000Z"),
        disabledBy: "municipio-1",
        disableReason: "Motivo",
        createdAt: new Date("2026-08-02T00:00:00.000Z"),
        updatedAt: new Date("2026-08-03T00:00:00.000Z"),
      }],
    });
    const repository = new AdminUsersRepository({ query });
    await expect(repository.findLandlordById("landlord-1")).resolves.toMatchObject({ id: "landlord-1", active: false, disabledBy: "municipio-1" });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE u.id = $1 AND u.role = 'ARRENDADOR'::\"Role\"");
    expect(sql).not.toContain("passwordHash");
    expect(values).toEqual(["landlord-1"]);
  });

  it("returns null for a missing user or a user with another role", async () => {
    const repository = new AdminUsersRepository({ query: vi.fn().mockResolvedValue({ rows: [] }) });
    await expect(repository.findLandlordById("tenant-1")).resolves.toBeNull();
    await expect(repository.findManagedUserById("missing")).resolves.toBeNull();
  });
});
