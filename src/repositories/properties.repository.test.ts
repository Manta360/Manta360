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
});
