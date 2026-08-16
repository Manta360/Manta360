import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), findDetailForMunicipality: vi.fn(), signedUrl: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ getActiveSession: mocks.session }));
vi.mock("@/repositories/admin-properties.server", () => ({ adminPropertiesRepository: { findDetailForMunicipality: mocks.findDetailForMunicipality } }));
vi.mock("@/lib/supabase/storage", () => ({ PROPERTY_IMAGES_BUCKET: "property-images", createStorageSignedUrl: mocks.signedUrl }));

import { GET } from "@/app/api/admin/properties/[id]/route";

const detail = {
  id: "property-pending", landlordId: "landlord-1", title: "Casa frente al mar", address: "Manta", monthlyRent: 650,
  status: "DISPONIBLE", description: "Con vista al mar", bedrooms: 2, bathrooms: 1, latitude: null, longitude: null,
  createdBy: "landlord-1", approved: false, approvedAt: null, approvedBy: null, disabledAt: null, disabledBy: null, disableReason: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"), updatedAt: new Date("2026-08-02T00:00:00.000Z"),
  users_properties_landlordIdTousers: { id: "landlord-1", fullName: "Ana Landlord", email: "ana@example.com", phone: "0991234567", nationalId: "1316551017", active: true, disabledAt: null, disableReason: null },
  images: [{ id: "image-1", storagePath: "properties/property-pending/image.webp", isPrimary: true, displayOrder: 0 }],
  services: ["Internet"], amenities: ["Piscina"],
};

describe("GET /api/admin/properties/[id]", () => {
  const context = { params: Promise.resolve({ id: "property-pending" }) };
  beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ sub: "municipio-1", role: "MUNICIPIO" }); mocks.findDetailForMunicipality.mockResolvedValue(detail); mocks.signedUrl.mockResolvedValue("https://signed.test/image"); });

  it("allows Municipio to inspect a pending property with relations and signed images", async () => {
    const response = await GET(new Request("http://localhost"), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.property.approved).toBe(false);
    expect(body.property.services).toEqual(["Internet"]);
    expect(body.property.amenities).toEqual(["Piscina"]);
    expect(body.property.images).toEqual([{ id: "image-1", url: "https://signed.test/image", isPrimary: true, displayOrder: 0 }]);
    expect(mocks.signedUrl).toHaveBeenCalledWith("property-images", "properties/property-pending/image.webp", 3600);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it.each([null, { sub: "tenant-1", role: "ARRENDATARIO" }, { sub: "landlord-2", role: "ARRENDADOR" }])("rejects non-municipal access", async (session) => {
    mocks.session.mockResolvedValue(session);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(403);
    expect(mocks.findDetailForMunicipality).not.toHaveBeenCalled();
  });

  it("keeps the historical missing-property response", async () => {
    mocks.findDetailForMunicipality.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(404);
  });
});
