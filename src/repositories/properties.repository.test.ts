import { describe, expect, it, vi } from "vitest";
import { PropertiesRepository, type PropertiesSqlExecutor } from "@/repositories/properties.repository";

describe("PropertiesRepository", () => {
  it("filtra exclusivamente por landlord parametrizado y conserva relaciones agregadas", async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ id: "property-1", images: [{ id: "image-1", storagePath: "p/a.jpg", isPrimary: true, displayOrder: 0 }], services: ["Agua"], amenities: ["Parqueo"] }] }) } as unknown as PropertiesSqlExecutor;
    const repository = new PropertiesRepository(executor);
    const properties = await repository.listMineForLandlord("landlord-a");
    expect(properties[0]).toMatchObject({ id: "property-1", services: ["Agua"], amenities: ["Parqueo"] });
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p."landlordId" = $1'), ["landlord-a"]);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY p."createdAt" DESC'), ["landlord-a"]);
  });

  it("busca detalle exclusivamente por propiedad y landlord parametrizados sin seleccionar usuarios", async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ id: "property-1", images: [], services: [], amenities: [] }] }) } as unknown as PropertiesSqlExecutor;
    const repository = new PropertiesRepository(executor);

    await expect(repository.findMineById("property-1", "landlord-a")).resolves.toMatchObject({ id: "property-1" });
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.id = $1 AND p."landlordId" = $2'), ["property-1", "landlord-a"]);
    expect(executor.query).toHaveBeenCalledWith(expect.not.stringContaining("public.users"), ["property-1", "landlord-a"]);
    expect(executor.query).toHaveBeenCalledWith(expect.not.stringContaining("passwordHash"), ["property-1", "landlord-a"]);
  });

  it("verifies image ownership and preserves historical image ordering", async () => {
    const executor = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: "property-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "image-1", storagePath: "properties/a.jpg", isPrimary: true, displayOrder: 0 }] }) } as unknown as PropertiesSqlExecutor;
    const repository = new PropertiesRepository(executor);

    await expect(repository.findOwnedPropertyForImages("property-1", "landlord-a")).resolves.toEqual({ id: "property-1" });
    await expect(repository.listImagesForProperty("property-1")).resolves.toEqual([{ id: "image-1", storagePath: "properties/a.jpg", isPrimary: true, displayOrder: 0 }]);
    expect(executor.query).toHaveBeenNthCalledWith(1, expect.stringContaining('WHERE p.id = $1 AND p."landlordId" = $2'), ["property-1", "landlord-a"]);
    expect(executor.query).toHaveBeenNthCalledWith(2, expect.stringContaining('ORDER BY i."isPrimary" DESC, i."displayOrder" ASC, i."createdAt" ASC'), ["property-1"]);
    expect(executor.query).toHaveBeenNthCalledWith(2, expect.not.stringContaining("passwordHash"), ["property-1"]);
  });

  it("mantiene los filtros existentes del catálogo público con valores parametrizados", async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ id: "catalog-1", landlord: { id: "landlord-1", fullName: "Owner" }, images: [], services: ["Agua"], amenities: [] }] }) } as unknown as PropertiesSqlExecutor;
    const repository = new PropertiesRepository(executor);

    await expect(repository.listCatalogProperties({ minPrice: 100, maxPrice: 500, services: ["Agua", "Parqueo"] })).resolves.toHaveLength(1);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining("p.status = 'DISPONIBLE'"), [100, 500, "Agua", "Parqueo"]);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining("p.approved = true"), [100, 500, "Agua", "Parqueo"]);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('p."monthlyRent" >= $1'), [100, 500, "Agua", "Parqueo"]);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('p."monthlyRent" <= $2'), [100, 500, "Agua", "Parqueo"]);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining("s_filter.name = $4"), [100, 500, "Agua", "Parqueo"]);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY p."createdAt" DESC'), [100, 500, "Agua", "Parqueo"]);
    expect(executor.query).toHaveBeenCalledWith(expect.not.stringContaining("passwordHash"), [100, 500, "Agua", "Parqueo"]);
  });
});
