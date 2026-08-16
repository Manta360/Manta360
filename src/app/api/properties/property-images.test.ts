import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/properties.server", () => ({ propertiesRepository: { findOwnedPropertyForImages: vi.fn(), listImagesForProperty: vi.fn() } }));
vi.mock("@/lib/file-validation", () => ({ UploadValidationError: class UploadValidationError extends Error {}, validateUpload: vi.fn() }));
vi.mock("@/lib/supabase/storage", () => ({
  PROPERTY_IMAGES_BUCKET: "property-images", createStorageSignedUrl: vi.fn().mockResolvedValue("https://signed/image"),
  propertyImagePath: vi.fn(), removeStorageFile: vi.fn(), uploadStorageFile: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    properties: { findFirst: vi.fn() },
    property_images: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getActiveSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { createStorageSignedUrl, removeStorageFile } from "@/lib/supabase/storage";
import { propertiesRepository } from "@/repositories/properties.server";
import { GET, POST } from "@/app/api/properties/[propertyId]/images/route";
import { DELETE, PATCH } from "@/app/api/properties/[propertyId]/images/[imageId]/route";

const session = vi.mocked(getActiveSession);
const db = prisma as unknown as {
  properties: Record<string, ReturnType<typeof vi.fn>>;
  property_images: Record<string, ReturnType<typeof vi.fn>>;
  $transaction: ReturnType<typeof vi.fn>;
};
const landlord = { sub: "landlord-1", email: "owner@test.com", role: "ARRENDADOR" as const, fullName: "Dueño" };
const context = { params: Promise.resolve({ propertyId: "property-1" }) };
const imageContext = { params: Promise.resolve({ propertyId: "property-1", imageId: "image-1" }) };
const image = { id: "image-1", propertyId: "property-1", storagePath: "properties/p1/a.jpg", isPrimary: true, displayOrder: 0, createdAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue(landlord);
  db.properties.findFirst.mockResolvedValue({ id: "property-1", status: "DISPONIBLE", approved: true });
  vi.mocked(propertiesRepository.findOwnedPropertyForImages).mockResolvedValue({ id: "property-1" });
  vi.mocked(propertiesRepository.listImagesForProperty).mockResolvedValue([image]);
  db.property_images.findMany.mockResolvedValue([image]);
  db.property_images.findFirst.mockResolvedValue(image);
  db.property_images.count.mockResolvedValue(4);
  db.property_images.update.mockResolvedValue({ ...image, isPrimary: false });
  db.property_images.delete.mockResolvedValue(image);
  db.property_images.updateMany.mockResolvedValue({ count: 1 });
  vi.mocked(removeStorageFile).mockResolvedValue();
  db.$transaction.mockImplementation(async (operation: unknown) => {
    const tx = { property_images: db.property_images };
    return typeof operation === "function" ? operation(tx) : Promise.all(operation as Promise<unknown>[]);
  });
});

describe("KAN-40 - imágenes de propiedades propias", () => {
  it("devuelve imágenes privadas de una propiedad propia", async () => {
    const response = await GET(new Request("http://localhost/api/properties/property-1/images"), context);
    expect(response.status).toBe(200);
    expect(propertiesRepository.findOwnedPropertyForImages).toHaveBeenCalledWith("property-1", landlord.sub);
    expect(propertiesRepository.listImagesForProperty).toHaveBeenCalledWith("property-1");
    expect(createStorageSignedUrl).toHaveBeenCalledWith("property-images", image.storagePath);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ images: [{ id: image.id, url: "https://signed/image", isPrimary: true, displayOrder: 0 }] });
  });

  it("no permite consultar imágenes de propiedad ajena", async () => {
    vi.mocked(propertiesRepository.findOwnedPropertyForImages).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(404);
  });

  it("preserves empty images and PostgreSQL ordering", async () => {
    vi.mocked(propertiesRepository.listImagesForProperty).mockResolvedValue([]);
    await expect((await GET(new Request("http://localhost"), context)).json()).resolves.toEqual({ images: [] });

    vi.mocked(propertiesRepository.listImagesForProperty).mockResolvedValue([
      image,
      { ...image, id: "image-2", storagePath: "properties/p1/b.jpg", isPrimary: false, displayOrder: 1 },
    ]);
    await expect((await GET(new Request("http://localhost"), context)).json()).resolves.toMatchObject({ images: [{ id: "image-1" }, { id: "image-2" }] });
  });

  it("requires a session and returns a safe PostgreSQL error", async () => {
    session.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(401);

    session.mockResolvedValue(landlord);
    vi.mocked(propertiesRepository.listImagesForProperty).mockRejectedValueOnce(new Error("SELECT passwordHash FROM users at database-host"));
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "No se pudieron cargar las imágenes" });
  });

  it("mantiene el máximo de doce imágenes", async () => {
    const form = new FormData();
    for (let index = 0; index < 13; index += 1) form.append("photos", new Blob(["image"], { type: "image/png" }), `image-${index}.png`);
    const response = await POST(new Request("http://localhost/api/properties/property-1/images", { method: "POST", body: form }), context);
    expect(response.status).toBe(400);
  });

  it("bloquea añadir imágenes a una propiedad inhabilitada", async () => {
    db.properties.findFirst.mockResolvedValue({ id: "property-1", status: "INHABILITADO" });
    expect((await POST(new Request("http://localhost", { method: "POST", body: new FormData() }), context)).status).toBe(409);
  });

  it("no permite bajar de tres imágenes una propiedad publicada", async () => {
    db.property_images.count.mockResolvedValue(3);
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), imageContext);
    expect(response.status).toBe(409);
    expect(removeStorageFile).not.toHaveBeenCalled();
  });

  it("reasigna la imagen principal antes de eliminarla", async () => {
    db.property_images.findFirst
      .mockResolvedValueOnce(image)
      .mockResolvedValueOnce({ ...image, id: "image-2", isPrimary: false, displayOrder: 1 });
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), imageContext);
    expect(response.status).toBe(204);
    expect(db.property_images.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isPrimary: true } }));
    expect(db.property_images.delete).toHaveBeenCalledWith({ where: { id: image.id } });
  });

  it("mantiene una principal al rechazar desmarcar la actual", async () => {
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPrimary: false }) }), imageContext);
    expect(response.status).toBe(400);
  });

  it("bloquea cambios de imágenes si la propiedad fue inhabilitada", async () => {
    db.properties.findFirst.mockResolvedValue({ id: "property-1", status: "INHABILITADO", approved: false });
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPrimary: true }) }), imageContext);
    expect(response.status).toBe(409);
  });

  it.each(["ARRENDATARIO", "MUNICIPIO"] as const)("rechaza gestionar imágenes para %s", async (role) => {
    session.mockResolvedValue({ ...landlord, role });
    expect((await GET(new Request("http://localhost"), context)).status).toBe(403);
    expect((await PATCH(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPrimary: true }) }), imageContext)).status).toBe(403);
  });
});
