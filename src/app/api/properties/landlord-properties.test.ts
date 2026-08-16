import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/lib/owned-property", () => ({
  ownedPropertyInclude: {},
  serializeOwnedProperty: vi.fn(async (property) => property),
}));
vi.mock("@/lib/owned-property-pg", () => ({ serializeMineProperty: vi.fn(async (property) => property) }));
vi.mock("@/repositories/properties.server", () => ({ propertiesRepository: { listMineForLandlord: vi.fn() } }));
vi.mock("@/lib/supabase/storage", () => ({
  PROPERTY_IMAGES_BUCKET: "property-images",
  removeStorageFile: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    properties: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    property_images: { deleteMany: vi.fn() },
    contracts: { count: vi.fn() },
    contract_requests: { count: vi.fn() },
    incident_reports: { count: vi.fn() },
    chat_messages: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getActiveSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { removeStorageFile } from "@/lib/supabase/storage";
import { propertiesRepository } from "@/repositories/properties.server";
import { GET as listMine } from "@/app/api/properties/mine/route";
import { DELETE, GET, PATCH } from "@/app/api/properties/[propertyId]/route";

const session = vi.mocked(getActiveSession);
const db = prisma as unknown as {
  properties: Record<string, ReturnType<typeof vi.fn>>;
  property_images: Record<string, ReturnType<typeof vi.fn>>;
  contracts: Record<string, ReturnType<typeof vi.fn>>;
  contract_requests: Record<string, ReturnType<typeof vi.fn>>;
  incident_reports: Record<string, ReturnType<typeof vi.fn>>;
  chat_messages: Record<string, ReturnType<typeof vi.fn>>;
  $transaction: ReturnType<typeof vi.fn>;
};

const landlord = { sub: "landlord-1", email: "owner@test.com", role: "ARRENDADOR" as const, fullName: "Dueño" };
const property = {
  id: "property-1", landlordId: landlord.sub, status: "DISPONIBLE", approved: false,
  title: "Departamento central", address: "Manta", monthlyRent: 500, bedrooms: 2, bathrooms: 1,
  description: "Departamento cómodo con buena ubicación", latitude: -0.95, longitude: -80.7,
  property_images: [], property_services: [], property_amenities: [], createdAt: new Date(), updatedAt: new Date(),
};
const context = { params: Promise.resolve({ propertyId: property.id }) };
const request = (body: unknown) => new Request(`http://localhost/api/properties/${property.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function transactionMock() {
  const tx = {
    service_catalog: { upsert: vi.fn() }, amenity_catalog: { upsert: vi.fn() },
    properties: { findFirst: db.properties.findFirst, update: db.properties.update },
    contracts: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  db.$transaction.mockImplementation(async (operation: unknown) => {
    if (typeof operation === "function") return operation(tx);
    return Promise.all(operation as Promise<unknown>[]);
  });
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue(landlord);
  db.properties.findFirst.mockResolvedValue(property);
  db.properties.findMany.mockResolvedValue([property]);
  vi.mocked(propertiesRepository.listMineForLandlord).mockResolvedValue([property] as never);
  db.properties.update.mockResolvedValue(property);
  db.properties.delete.mockResolvedValue(property);
  db.property_images.deleteMany.mockResolvedValue({ count: 0 });
  db.contracts.count.mockResolvedValue(0);
  db.contract_requests.count.mockResolvedValue(0);
  db.incident_reports.count.mockResolvedValue(0);
  db.chat_messages.count.mockResolvedValue(0);
  vi.mocked(removeStorageFile).mockResolvedValue();
  transactionMock();
});

describe("KAN-40 - propiedades propias", () => {
  it("lista exclusivamente propiedades del Arrendador, incluidas las no públicas", async () => {
    vi.mocked(propertiesRepository.listMineForLandlord).mockResolvedValue([{ ...property, approved: false, status: "INHABILITADO" }] as never);
    const response = await listMine();
    expect(response.status).toBe(200);
    expect(propertiesRepository.listMineForLandlord).toHaveBeenCalledWith(landlord.sub);
    await expect(response.json()).resolves.toMatchObject({ properties: [{ id: property.id, approved: false, status: "INHABILITADO" }] });
  });

  it("no mezcla propiedades de otro Arrendador en el listado", async () => {
    await listMine();
    expect(propertiesRepository.listMineForLandlord).toHaveBeenCalledWith(landlord.sub);
  });

  it.each(["ARRENDATARIO", "MUNICIPIO"] as const)("rechaza a %s en el listado privado", async (role) => {
    session.mockResolvedValue({ ...landlord, role });
    expect((await listMine()).status).toBe(403);
  });

  it("devuelve el detalle de una propiedad propia", async () => {
    const response = await GET(new Request("http://localhost/api/properties/property-1"), context);
    expect(response.status).toBe(200);
    expect(db.properties.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: property.id, landlordId: landlord.sub } }));
  });

  it.each(["propiedad ajena", "propiedad inexistente"])("devuelve 404 para %s", async () => {
    db.properties.findFirst.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/properties/property-1"), context)).status).toBe(404);
  });

  it("edita una propiedad propia", async () => {
    const response = await PATCH(request({ title: "Departamento actualizado" }), context);
    expect(response.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalled();
  });

  it("rechaza editar una propiedad ajena", async () => {
    db.properties.findFirst.mockResolvedValue(null);
    expect((await PATCH(request({ title: "Departamento actualizado" }), context)).status).toBe(404);
  });

  it.each([{ landlordId: "otro" }, { approved: true }])("rechaza campos administrativos o de propiedad", async (body) => {
    const response = await PATCH(request(body), context);
    expect(response.status).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("bloquea editar una propiedad inhabilitada", async () => {
    db.properties.findFirst.mockResolvedValue({ ...property, status: "INHABILITADO" });
    expect((await PATCH(request({ title: "Cambio" }), context)).status).toBe(409);
  });

  it.each([
    ["DISPONIBLE", "MANTENIMIENTO"],
    ["MANTENIMIENTO", "DISPONIBLE"],
  ] as const)("permite transición %s a %s", async (current, next) => {
    db.properties.findFirst.mockResolvedValue({ ...property, status: current });
    const response = await PATCH(request({ status: next }), context);
    expect(response.status).toBe(200);
    expect(db.properties.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: next }) }));
  });

  it("rechaza establecer INHABILITADO", async () => {
    expect((await PATCH(request({ status: "INHABILITADO" }), context)).status).toBe(400);
  });

  it("rechaza establecer OCUPADO manualmente", async () => {
    expect((await PATCH(request({ status: "OCUPADO" }), context)).status).toBe(400);
  });

  it("rechaza salir de INHABILITADO", async () => {
    db.properties.findFirst.mockResolvedValue({ ...property, status: "INHABILITADO" });
    expect((await PATCH(request({ status: "DISPONIBLE" }), context)).status).toBe(409);
  });

  it("bloquea transición de estado con contrato activo", async () => {
    db.contracts.count.mockResolvedValue(1);
    expect((await PATCH(request({ status: "MANTENIMIENTO" }), context)).status).toBe(409);
  });

  it("elimina una propiedad propia sin relaciones bloqueantes y limpia sus archivos", async () => {
    db.properties.findFirst.mockResolvedValue({ id: property.id, status: "DISPONIBLE", property_images: [{ id: "image-1", storagePath: "properties/p1/a.jpg" }] });
    const response = await DELETE(new Request("http://localhost/api/properties/property-1", { method: "DELETE" }), context);
    expect(response.status).toBe(204);
    expect(removeStorageFile).toHaveBeenCalledWith("property-images", "properties/p1/a.jpg");
    expect(db.property_images.deleteMany).toHaveBeenCalledWith({ where: { propertyId: property.id } });
    expect(db.properties.delete).toHaveBeenCalledWith({ where: { id: property.id } });
  });

  it("rechaza eliminar una propiedad ajena", async () => {
    db.properties.findFirst.mockResolvedValue(null);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(404);
  });

  it("bloquea eliminación con contrato activo", async () => {
    db.properties.findFirst.mockResolvedValue({ id: property.id, status: "DISPONIBLE", property_images: [] });
    db.contracts.count.mockResolvedValue(1);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(409);
  });

  it.each([
    ["contratos", "contracts"], ["solicitudes", "contract_requests"], ["incidencias", "incident_reports"], ["mensajes", "chat_messages"],
  ] as const)("bloquea eliminación cuando existen %s históricos", async (_name, model) => {
    db.properties.findFirst.mockResolvedValue({ id: property.id, status: "DISPONIBLE", property_images: [] });
    db[model].count.mockResolvedValue(1);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(409);
  });

  it.each(["ARRENDATARIO", "MUNICIPIO"] as const)("rechaza operaciones de escritura para %s", async (role) => {
    session.mockResolvedValue({ ...landlord, role });
    expect((await PATCH(request({ title: "Cambio" }), context)).status).toBe(403);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(403);
  });
});
