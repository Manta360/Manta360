import { describe, expect, it, vi } from "vitest";
import { AdminPropertiesRepository } from "@/repositories/admin-properties.repository";

const propertyRow = {
  id: "property-1", landlordId: "landlord-1", title: "Vista al mar", address: "Manta", monthlyRent: "750.50", status: "OCUPADO",
  createdAt: new Date("2026-08-03T00:00:00.000Z"), updatedAt: new Date("2026-08-04T00:00:00.000Z"), description: null,
  bedrooms: null, bathrooms: null, latitude: null, longitude: null, createdBy: null, approved: false, approvedAt: null,
  approvedBy: null, disabledAt: null, disabledBy: null, disableReason: null, landlordUserId: "landlord-1",
  landlordFullName: "Ana", landlordEmail: "ana@test", landlordPhone: null, landlordNationalId: "1316551017",
  landlordActive: true, landlordDisabledAt: null, landlordDisableReason: null,
};

describe("AdminPropertiesRepository", () => {
  it("preserves the municipal property shape, safe landlord projection, order query and numeric counts", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [propertyRow] })
      .mockResolvedValueOnce({ rows: [{ users: "4", pendingProperties: "1", occupiedProperties: "1", activeContracts: "1", disabledLandlords: "1", disabledProperties: "0" }] });
    const result = await new AdminPropertiesRepository({ query }).listForMunicipality();

    expect(result.properties[0]).toMatchObject({ id: "property-1", monthlyRent: 750.5, users_properties_landlordIdTousers: { id: "landlord-1", fullName: "Ana", nationalId: "1316551017" } });
    expect(typeof result.properties[0]?.monthlyRent).toBe("number");
    expect(result.stats).toEqual({ users: 4, pendingProperties: 1, occupiedProperties: 1, activeContracts: 1, disabledLandlords: 1, disabledProperties: 0 });

    const [propertiesSql] = query.mock.calls[0] as [string];
    const [statsSql] = query.mock.calls[1] as [string];
    expect(propertiesSql).toContain('ORDER BY p."createdAt" DESC');
    expect(propertiesSql).toContain('INNER JOIN public.users u ON u.id = p."landlordId"');
    expect(propertiesSql).not.toContain("users.*");
    expect(propertiesSql).not.toContain("passwordHash");
    expect(statsSql).toContain('WHERE approved = false');
    expect(statsSql).toContain("'OCUPADO'::\"PropertyStatus\"");
    expect(statsSql).toContain("'ACTIVO'::\"ContractStatus\"");
    expect(statsSql).toContain("'ARRENDADOR'::\"Role\" AND active = false");
    expect(statsSql).toContain("'INHABILITADO'::\"PropertyStatus\"");
  });

  it("preserves six zero-valued counters", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ users: "0", pendingProperties: "0", occupiedProperties: "0", activeContracts: "0", disabledLandlords: "0", disabledProperties: "0" }] });
    await expect(new AdminPropertiesRepository({ query }).listForMunicipality()).resolves.toEqual({
      properties: [], stats: { users: 0, pendingProperties: 0, occupiedProperties: 0, activeContracts: 0, disabledLandlords: 0, disabledProperties: 0 },
    });
  });

  it("loads a property detail by id with ordered image metadata, services and amenities", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ ...propertyRow, images: [{ id: "image-1", storagePath: "properties/property-1/image.webp", isPrimary: true, displayOrder: 0 }], services: ["Internet"], amenities: ["Piscina"] }] });
    const result = await new AdminPropertiesRepository({ query }).findDetailForMunicipality("property-1");
    expect(result).toMatchObject({ id: "property-1", monthlyRent: 750.5, services: ["Internet"], amenities: ["Piscina"], images: [{ id: "image-1", isPrimary: true }] });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('WHERE p.id = $1');
    expect(sql).toContain('ORDER BY i."isPrimary" DESC, i."displayOrder" ASC');
    expect(sql).toContain("property_services");
    expect(sql).toContain("property_amenities");
    expect(sql).not.toContain("users.*");
    expect(sql).not.toContain("passwordHash");
    expect(values).toEqual(["property-1"]);
  });
});
