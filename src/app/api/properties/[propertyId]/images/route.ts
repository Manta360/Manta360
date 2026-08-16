import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { propertiesRepository } from "@/repositories/properties.server";
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
  return propertiesRepository.findOwnedEditable(propertyId, userId);
}

async function requireOwnedEditableProperty(propertyId: string, userId: string) {
  const property = await getOwnedProperty(propertyId, userId);
  if (!property) return { error: NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 }) };
  if (property.status === "INHABILITADO") {
    return { error: NextResponse.json({ error: "La propiedad fue inhabilitada por el Municipio y no permite gestionar imÃ¡genes" }, { status: 409 }) };
  }
  return { property };
}

async function requireLandlord() {
  const session = await getActiveSession();
  if (!session) return { error: NextResponse.json({ error: "SesiÃ³n requerida" }, { status: 401 }) };
  if (session.role !== "ARRENDADOR") return { error: NextResponse.json({ error: "OperaciÃ³n no permitida" }, { status: 403 }) };
  return { session };
}

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await requireLandlord();
  if ("error" in authorization) return authorization.error!;
  const { propertyId } = await context.params;
  try {
    if (!await propertiesRepository.findOwnedPropertyForImages(propertyId, authorization.session.sub)) {
      return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
    }

    const images = await propertiesRepository.listImagesForProperty(propertyId);
    return NextResponse.json({
      images: await Promise.all(images.map(async (image) => ({
        id: image.id,
        url: await createStorageSignedUrl(PROPERTY_IMAGES_BUCKET, image.storagePath),
        isPrimary: image.isPrimary,
        displayOrder: image.displayOrder,
      }))),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("property images list error", error);
    return NextResponse.json({ error: "No se pudieron cargar las imágenes" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const authorization = await requireLandlord();
  if ("error" in authorization) return authorization.error!;
  const { propertyId } = await context.params;
  const ownership = await requireOwnedEditableProperty(propertyId, authorization.session.sub);
  if ("error" in ownership) return ownership.error!;

  const formData = await request.formData();
  const files = formData.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "Debes cargar al menos una imagen" }, { status: 400 });
  if (files.length > 12) return NextResponse.json({ error: "Puedes cargar como mÃ¡ximo 12 imÃ¡genes por operaciÃ³n" }, { status: 400 });

  const { count: existingCount, hashes } = await propertiesRepository.imageCountAndHashes(propertyId);
  if (existingCount + files.length > 12) return NextResponse.json({ error: "Una propiedad puede tener como mÃ¡ximo 12 imÃ¡genes" }, { status: 400 });

  const uploadedPaths: string[] = [];
  try {
    const existingHashes = new Set(hashes);
    const created = [];
    for (const [offset, file] of files.entries()) {
      const upload = await validateUpload(file, "property-image");
      if (existingHashes.has(upload.sha256)) throw new UploadValidationError("La imagen ya existe en esta propiedad");
      existingHashes.add(upload.sha256);
      const storagePath = propertyImagePath(propertyId, upload.extension);
      await uploadStorageFile(PROPERTY_IMAGES_BUCKET, storagePath, upload);
      uploadedPaths.push(storagePath);
      created.push(await propertiesRepository.createImage({
        propertyId, storagePath, originalName: upload.originalName, extension: upload.extension,
        mimeType: upload.mimeType, fileSize: upload.fileSize, sha256: upload.sha256,
        isPrimary: existingCount === 0 && offset === 0, displayOrder: existingCount + offset,
      }));
    }
    return NextResponse.json({ images: await Promise.all(created.map(async (image) => ({ id: image.id, url: await createStorageSignedUrl(PROPERTY_IMAGES_BUCKET, image.storagePath), isPrimary: image.isPrimary, displayOrder: image.displayOrder }))) }, { status: 201 });
  } catch (error) {
    await Promise.all(uploadedPaths.map((path) => removeStorageFile(PROPERTY_IMAGES_BUCKET, path).catch((cleanupError) => console.error("property image cleanup error", cleanupError))));
    if (error instanceof UploadValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("property images create error", error);
    return NextResponse.json({ error: "No se pudieron cargar las imÃ¡genes" }, { status: 500 });
  }
}
