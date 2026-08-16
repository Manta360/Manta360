import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/storage", () => ({ PROPERTY_IMAGES_BUCKET: "property-images", createStorageSignedUrl: vi.fn(async (_bucket, path) => `https://signed/${path}`) }));

import { serializeCatalogProperty } from "@/lib/property-catalog-pg";

describe("serializeCatalogProperty", () => {
  it("conserva el shape público y no serializa datos privados", async () => {
    const result = await serializeCatalogProperty({
      id: "property-1", title: "Casa", address: "Manta", monthlyRent: "200.25", status: "DISPONIBLE", description: null, bedrooms: null, bathrooms: 1, latitude: null, longitude: "-80.7",
      landlord: { id: "landlord-1", fullName: "Owner" }, images: [{ id: "image-1", storagePath: "properties/a.jpg", isPrimary: true, displayOrder: 0 }], services: ["Agua"], amenities: [], createdAt: new Date("2026-01-01T00:00:00.000Z"), updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      passwordHash: "never-public", nationalId: "never-public",
    } as never);

    expect(result).toEqual(expect.objectContaining({ monthlyRent: 200.25, latitude: null, longitude: -80.7, landlord: { id: "landlord-1", fullName: "Owner" }, image: "https://signed/properties/a.jpg", createdAt: "2026-01-01T00:00:00.000Z" }));
    expect(JSON.stringify(result)).not.toContain("passwordHash");
    expect(JSON.stringify(result)).not.toContain("nationalId");
  });
});
