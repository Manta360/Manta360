import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { UploadValidationError, validateUpload } from "@/lib/file-validation";
import {
  PROPERTY_IMAGES_BUCKET,
  createStorageSignedUrl,
  propertyImagePath,
  removeStorageFile,
  uploadStorageFile,
} from "@/lib/supabase/storage";

type RouteContext = { params: Promise<{ propertyId: string }> };

async function getOwnedProperty(propertyId: string, userId: string) {
  return prisma.properties.findFirst({ where: { id: propertyId, landlordId: userId }, select: { id: true } });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (session.role !== "ARRENDADOR") return NextResponse.json({ error: "Operación no permitida" }, { status: 403 });
  const { propertyId } = await context.params;
  if (!await getOwnedProperty(propertyId, session.sub)) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

  const formData = await request.formData();
  const files = formData.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "Debes cargar al menos una imagen" }, { status: 400 });
  if (files.length > 12) return NextResponse.json({ error: "Puedes cargar como máximo 12 imágenes por operación" }, { status: 400 });

  const existingCount = await prisma.property_images.count({ where: { propertyId } });
  if (existingCount + files.length > 12) return NextResponse.json({ error: "Una propiedad puede tener como máximo 12 imágenes" }, { status: 400 });

  const uploadedPaths: string[] = [];
  try {
    const existingHashes = new Set((await prisma.property_images.findMany({ where: { propertyId }, select: { sha256: true } })).map(({ sha256 }) => sha256));
    const created = [];
    for (const [offset, file] of files.entries()) {
      const upload = await validateUpload(file, "property-image");
      if (existingHashes.has(upload.sha256)) throw new UploadValidationError("La imagen ya existe en esta propiedad");
      existingHashes.add(upload.sha256);
      const storagePath = propertyImagePath(propertyId, upload.extension);
      await uploadStorageFile(PROPERTY_IMAGES_BUCKET, storagePath, upload);
      uploadedPaths.push(storagePath);
      created.push(await prisma.property_images.create({
        data: {
          propertyId,
          storagePath,
          originalName: upload.originalName,
          extension: upload.extension,
          mimeType: upload.mimeType,
          fileSize: BigInt(upload.fileSize),
          sha256: upload.sha256,
          isPrimary: existingCount === 0 && offset === 0,
          displayOrder: existingCount + offset,
        },
      }));
    }
    return NextResponse.json({ images: await Promise.all(created.map(async (image) => ({ id: image.id, url: await createStorageSignedUrl(PROPERTY_IMAGES_BUCKET, image.storagePath), isPrimary: image.isPrimary, displayOrder: image.displayOrder }))) }, { status: 201 });
  } catch (error) {
    await Promise.all(uploadedPaths.map((path) => removeStorageFile(PROPERTY_IMAGES_BUCKET, path).catch((cleanupError) => console.error("property image cleanup error", cleanupError))));
    if (error instanceof UploadValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("property images create error", error);
    return NextResponse.json({ error: "No se pudieron cargar las imágenes" }, { status: 500 });
  }
}
