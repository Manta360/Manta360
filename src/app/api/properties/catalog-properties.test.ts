import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/properties.server", () => ({ propertiesRepository: { listCatalogProperties: vi.fn() } }));
vi.mock("@/lib/property-catalog-pg", () => ({ serializeCatalogProperty: vi.fn(async (property) => property) }));

import { getActiveSession } from "@/lib/server-auth";
import { propertiesRepository } from "@/repositories/properties.server";
import { GET } from "@/app/api/properties/route";

const property = {
  id: "catalog-1",
  title: "Casa",
  address: "Manta",
  monthlyRent: "200.25",
  status: "DISPONIBLE",
  description: null,
  bedrooms: null,
  bathrooms: 1,
  latitude: null,
  longitude: "-80.7",
  landlord: { id: "landlord-1", fullName: "Owner" },
  images: [],
  services: ["Agua"],
  amenities: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const tenantSession = { sub: "tenant-1", role: "ARRENDATARIO" as const, email: "tenant@test.com" };
const emptyFilters = { location: null, minPrice: null, maxPrice: null, services: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSession).mockResolvedValue(null);
  vi.mocked(propertiesRepository.listCatalogProperties).mockResolvedValue([property] as never);
});

describe("GET /api/properties", () => {
  it("es público y conserva el catálogo base sin filtros avanzados", async () => {
    const response = await GET(new Request("http://localhost/api/properties"));
    expect(response.status).toBe(200);
    expect(propertiesRepository.listCatalogProperties).toHaveBeenCalledWith(emptyFilters);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toMatchObject({ properties: [{ id: property.id, landlord: property.landlord }] });
  });

  it("rechaza filtros avanzados para visitante sin sesión", async () => {
    const response = await GET(new Request("http://localhost/api/properties?location=San%20Antonio&minPrice=100"));
    expect(response.status).toBe(403);
    expect(propertiesRepository.listCatalogProperties).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Los filtros avanzados solo estan disponibles para arrendatarios autenticados",
    });
  });

  it("rechaza filtros avanzados para roles distintos de arrendatario", async () => {
    vi.mocked(getActiveSession).mockResolvedValue({ sub: "landlord-1", role: "ARRENDADOR", email: "a@test.com" });
    const response = await GET(new Request("http://localhost/api/properties?services=Agua"));
    expect(response.status).toBe(403);
    expect(propertiesRepository.listCatalogProperties).not.toHaveBeenCalled();
  });

  it("aplica location, precio y services cuando el arrendatario está autenticado", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(tenantSession);
    await GET(new Request("http://localhost/api/properties?location=San%20Antonio&minPrice=100&maxPrice=500&services=Agua,%20Parqueo"));
    expect(propertiesRepository.listCatalogProperties).toHaveBeenCalledWith({
      location: "San Antonio",
      minPrice: 100,
      maxPrice: 500,
      services: ["Agua", "Parqueo"],
    });
  });

  it("ignora exactamente precios inválidos o negativos para arrendatario", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(tenantSession);
    await GET(new Request("http://localhost/api/properties?minPrice=invalid&maxPrice=-1&services=, ,"));
    expect(propertiesRepository.listCatalogProperties).toHaveBeenCalledWith(emptyFilters);
  });

  it("mantiene el error genérico sin exponer detalles PostgreSQL", async () => {
    vi.mocked(propertiesRepository.listCatalogProperties).mockRejectedValue(new Error("SELECT passwordHash FROM users at host internal"));
    const response = await GET(new Request("http://localhost/api/properties"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "No se pudo cargar el catálogo" });
  });
});
