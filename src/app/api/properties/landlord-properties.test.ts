import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/lib/owned-property-pg", () => ({ serializeMineProperty: vi.fn(async (property) => property) }));
vi.mock("@/repositories/properties.server", () => ({
  propertiesRepository: { listMineForLandlord: vi.fn(), findMineById: vi.fn(), countEffectiveContracts: vi.fn(), changeLandlordStatus: vi.fn(), updateOwnedProperty: vi.fn(), findOwnedForDeletion: vi.fn(), relatedHistoryCounts: vi.fn(), deleteProperty: vi.fn() },
  runPropertiesTransaction: vi.fn(),
}));
vi.mock("@/lib/supabase/storage", () => ({ PROPERTY_IMAGES_BUCKET: "property-images", removeStorageFile: vi.fn() }));

import { getActiveSession } from "@/lib/server-auth";
import { removeStorageFile } from "@/lib/supabase/storage";
import { propertiesRepository, runPropertiesTransaction } from "@/repositories/properties.server";
import { GET as listMine } from "@/app/api/properties/mine/route";
import { DELETE, GET, PATCH } from "@/app/api/properties/[propertyId]/route";

const landlord = { sub: "landlord-1", email: "owner@test.com", role: "ARRENDADOR" as const, fullName: "Dueño" };
const property = { id: "property-1", status: "DISPONIBLE", approved: false, disableReason: null, title: "Departamento central", address: "Manta", monthlyRent: 500, bedrooms: 2, bathrooms: 1, description: "Departamento cómodo", latitude: -0.95, longitude: -80.7, images: [], services: [], amenities: [], createdAt: new Date(), updatedAt: new Date() };
const context = { params: Promise.resolve({ propertyId: property.id }) };
const request = (body: unknown) => new Request("http://localhost/api/properties/property-1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSession).mockResolvedValue(landlord);
  vi.mocked(propertiesRepository.listMineForLandlord).mockResolvedValue([property] as never);
  vi.mocked(propertiesRepository.findMineById).mockResolvedValue(property as never);
  vi.mocked(propertiesRepository.countEffectiveContracts).mockResolvedValue(0);
  vi.mocked(propertiesRepository.changeLandlordStatus).mockResolvedValue(true);
  vi.mocked(propertiesRepository.updateOwnedProperty).mockResolvedValue(true);
  vi.mocked(propertiesRepository.findOwnedForDeletion).mockResolvedValue({ id: property.id, status: "DISPONIBLE", images: [{ storagePath: "properties/p1/a.jpg" }] });
  vi.mocked(propertiesRepository.relatedHistoryCounts).mockResolvedValue({ activeContracts: 0, contracts: 0, requests: 0, incidents: 0, messages: 0 });
  vi.mocked(propertiesRepository.deleteProperty).mockResolvedValue();
  vi.mocked(runPropertiesTransaction).mockImplementation(async (operation) => operation(propertiesRepository));
  vi.mocked(removeStorageFile).mockResolvedValue();
});

describe("KAN-40 - propiedades propias por PostgreSQL", () => {
  it("lista solo propiedades del arrendador", async () => {
    const response = await listMine();
    expect(response.status).toBe(200);
    expect(propertiesRepository.listMineForLandlord).toHaveBeenCalledWith(landlord.sub);
  });
  it("devuelve detalle propio sin passwordHash", async () => {
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain("passwordHash");
  });
  it("devuelve 404 para propiedad ajena", async () => {
    vi.mocked(propertiesRepository.findMineById).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(404);
  });
  it("requiere arrendador", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(null);
    expect((await PATCH(request({ title: "x" }), context)).status).toBe(401);
    vi.mocked(getActiveSession).mockResolvedValue({ ...landlord, role: "MUNICIPIO" });
    expect((await PATCH(request({ title: "x" }), context)).status).toBe(403);
  });
  it("actualiza los datos propios mediante transacción PG", async () => {
    const response = await PATCH(request({ title: "Departamento actualizado" }), context);
    expect(response.status).toBe(200);
    expect(runPropertiesTransaction).toHaveBeenCalled();
    expect(propertiesRepository.updateOwnedProperty).toHaveBeenCalled();
  });
  it("bloquea edición de inhabilitada", async () => {
    vi.mocked(propertiesRepository.findMineById).mockResolvedValue({ ...property, status: "INHABILITADO" } as never);
    expect((await PATCH(request({ title: "Cambio" }), context)).status).toBe(409);
  });
  it.each([["DISPONIBLE", "MANTENIMIENTO"], ["MANTENIMIENTO", "DISPONIBLE"]] as const)("preserva transición %s a %s", async (current, next) => {
    vi.mocked(propertiesRepository.findMineById).mockResolvedValue({ ...property, status: current } as never);
    expect((await PATCH(request({ status: next }), context)).status).toBe(200);
    expect(propertiesRepository.changeLandlordStatus).toHaveBeenCalledWith(property.id, landlord.sub, next);
  });
  it("bloquea estado contractual o activo", async () => {
    expect((await PATCH(request({ status: "OCUPADO" }), context)).status).toBe(400);
    vi.mocked(propertiesRepository.countEffectiveContracts).mockResolvedValue(1);
    expect((await PATCH(request({ status: "MANTENIMIENTO" }), context)).status).toBe(409);
  });
  it("elimina sin historial, eliminando archivos primero", async () => {
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), context);
    expect(response.status).toBe(204);
    expect(removeStorageFile).toHaveBeenCalledWith("property-images", "properties/p1/a.jpg");
    expect(propertiesRepository.deleteProperty).toHaveBeenCalledWith(property.id);
  });
  it("preserva bloqueos de eliminación", async () => {
    vi.mocked(propertiesRepository.findOwnedForDeletion).mockResolvedValue(null);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(404);
    vi.mocked(propertiesRepository.findOwnedForDeletion).mockResolvedValue({ id: property.id, status: "DISPONIBLE", images: [] });
    vi.mocked(propertiesRepository.relatedHistoryCounts).mockResolvedValue({ activeContracts: 0, contracts: 1, requests: 0, incidents: 0, messages: 0 });
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(409);
  });
});
