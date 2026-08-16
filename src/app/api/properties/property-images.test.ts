import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/properties.server", () => ({
  propertiesRepository: { findOwnedPropertyForImages: vi.fn(), listImagesForProperty: vi.fn(), findOwnedEditable: vi.fn(), imageCountAndHashes: vi.fn(), findOwnedImage: vi.fn(), updateImage: vi.fn(), deleteImageAndPromote: vi.fn(), createImage: vi.fn() },
  runPropertiesTransaction: vi.fn(),
}));
vi.mock("@/lib/file-validation", () => ({ UploadValidationError: class UploadValidationError extends Error {}, validateUpload: vi.fn() }));
vi.mock("@/lib/supabase/storage", () => ({ PROPERTY_IMAGES_BUCKET: "property-images", createStorageSignedUrl: vi.fn().mockResolvedValue("https://signed/image"), propertyImagePath: vi.fn(), removeStorageFile: vi.fn(), uploadStorageFile: vi.fn() }));

import { getActiveSession } from "@/lib/server-auth";
import { createStorageSignedUrl, removeStorageFile } from "@/lib/supabase/storage";
import { propertiesRepository, runPropertiesTransaction } from "@/repositories/properties.server";
import { GET, POST } from "@/app/api/properties/[propertyId]/images/route";
import { DELETE, PATCH } from "@/app/api/properties/[propertyId]/images/[imageId]/route";

const landlord = { sub: "landlord-1", email: "owner@test.com", role: "ARRENDADOR" as const, fullName: "Dueño" };
const context = { params: Promise.resolve({ propertyId: "property-1" }) };
const imageContext = { params: Promise.resolve({ propertyId: "property-1", imageId: "image-1" }) };
const image = { id: "image-1", storagePath: "properties/p1/a.jpg", isPrimary: true, displayOrder: 0, sha256: "a".repeat(64) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveSession).mockResolvedValue(landlord);
  vi.mocked(propertiesRepository.findOwnedPropertyForImages).mockResolvedValue({ id: "property-1" });
  vi.mocked(propertiesRepository.listImagesForProperty).mockResolvedValue([image]);
  vi.mocked(propertiesRepository.findOwnedEditable).mockResolvedValue({ id: "property-1", status: "DISPONIBLE" });
  vi.mocked(propertiesRepository.imageCountAndHashes).mockResolvedValue({ count: 4, hashes: [] });
  vi.mocked(propertiesRepository.findOwnedImage).mockResolvedValue(image);
  vi.mocked(propertiesRepository.updateImage).mockResolvedValue(image);
  vi.mocked(propertiesRepository.createImage).mockResolvedValue(image);
  vi.mocked(propertiesRepository.deleteImageAndPromote).mockResolvedValue();
  vi.mocked(runPropertiesTransaction).mockImplementation(async (operation) => operation(propertiesRepository));
  vi.mocked(removeStorageFile).mockResolvedValue();
});

describe("KAN-40 - imágenes de propiedades propias por PostgreSQL", () => {
  it("devuelve imágenes privadas ordenadas", async () => {
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(propertiesRepository.findOwnedPropertyForImages).toHaveBeenCalledWith("property-1", landlord.sub);
    expect(createStorageSignedUrl).toHaveBeenCalledWith("property-images", image.storagePath);
    await expect(response.json()).resolves.toEqual({ images: [{ id: image.id, url: "https://signed/image", isPrimary: true, displayOrder: 0 }] });
  });
  it("aísla propiedad ajena y exige sesión", async () => {
    vi.mocked(propertiesRepository.findOwnedPropertyForImages).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(404);
    vi.mocked(getActiveSession).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(401);
  });
  it("mantiene máximo de doce imágenes", async () => {
    const form = new FormData();
    for (let index = 0; index < 13; index += 1) form.append("photos", new Blob(["image"], { type: "image/png" }), `image-${index}.png`);
    expect((await POST(new Request("http://localhost", { method: "POST", body: form }), context)).status).toBe(400);
  });
  it("bloquea cambios para propiedad inhabilitada", async () => {
    vi.mocked(propertiesRepository.findOwnedEditable).mockResolvedValue({ id: "property-1", status: "INHABILITADO" });
    expect((await PATCH(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPrimary: true }) }), imageContext)).status).toBe(409);
  });
  it("preserva principal y mínimo de tres", async () => {
    vi.mocked(propertiesRepository.imageCountAndHashes).mockResolvedValue({ count: 3, hashes: [] });
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), imageContext)).status).toBe(409);
    vi.mocked(propertiesRepository.imageCountAndHashes).mockResolvedValue({ count: 4, hashes: [] });
    expect((await PATCH(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPrimary: false }) }), imageContext)).status).toBe(400);
  });
  it("elimina metadata mediante transacción PG después de Storage", async () => {
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), imageContext)).status).toBe(204);
    expect(removeStorageFile).toHaveBeenCalledWith("property-images", image.storagePath);
    expect(runPropertiesTransaction).toHaveBeenCalled();
  });
});
