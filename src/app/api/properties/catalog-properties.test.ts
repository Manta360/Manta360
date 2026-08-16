import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/properties.server", () => ({ propertiesRepository: { listCatalogProperties: vi.fn() } }));
vi.mock("@/lib/property-catalog-pg", () => ({ serializeCatalogProperty: vi.fn(async (property) => property) }));

import { propertiesRepository } from "@/repositories/properties.server";
import { GET } from "@/app/api/properties/route";

const property = { id: "catalog-1", title: "Casa", address: "Manta", monthlyRent: "200.25", status: "DISPONIBLE", description: null, bedrooms: null, bathrooms: 1, latitude: null, longitude: "-80.7", landlord: { id: "landlord-1", fullName: "Owner" }, images: [], services: ["Agua"], amenities: [], createdAt: new Date(), updatedAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(propertiesRepository.listCatalogProperties).mockResolvedValue([property] as never);
});

describe("GET /api/properties", () => {
  it("es público y conserva el catálogo base", async () => {
    const response = await GET(new Request("http://localhost/api/properties"));
    expect(response.status).toBe(200);
    expect(propertiesRepository.listCatalogProperties).toHaveBeenCalledWith({ minPrice: null, maxPrice: null, services: [] });
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toMatchObject({ properties: [{ id: property.id, landlord: property.landlord }] });
  });

  it("preserva minPrice, maxPrice y services existentes", async () => {
    await GET(new Request("http://localhost/api/properties?minPrice=100&maxPrice=500&services=Agua,%20Parqueo"));
    expect(propertiesRepository.listCatalogProperties).toHaveBeenCalledWith({ minPrice: 100, maxPrice: 500, services: ["Agua", "Parqueo"] });
  });

  it("ignora exactamente precios inválidos o negativos", async () => {
    await GET(new Request("http://localhost/api/properties?minPrice=invalid&maxPrice=-1&services=, ,"));
    expect(propertiesRepository.listCatalogProperties).toHaveBeenCalledWith({ minPrice: null, maxPrice: null, services: [] });
  });

  it("mantiene el error genérico sin exponer detalles PostgreSQL", async () => {
    vi.mocked(propertiesRepository.listCatalogProperties).mockRejectedValue(new Error("SELECT passwordHash FROM users at host internal"));
    const response = await GET(new Request("http://localhost/api/properties"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "No se pudo cargar el catálogo" });
  });
});
