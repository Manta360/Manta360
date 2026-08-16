import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/server-auth";
import { PROPERTY_IMAGES_BUCKET, removeStorageFile } from "@/lib/supabase/storage";
import { propertiesRepository, runPropertiesTransaction } from "@/repositories/properties.server";

type RouteContext = { params: Promise<{ propertyId: string; imageId: string }> };
const imageUpdateSchema = z.object({ isPrimary: z.boolean().optional(), displayOrder: z.number().int().min(0).max(1000).optional() }).refine((value) => value.isPrimary !== undefined || value.displayOrder !== undefined);

async function requireOwnedEditableProperty(propertyId: string, userId: string) {
  const property = await propertiesRepository.findOwnedEditable(propertyId, userId);
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

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await requireLandlord();
  if ("error" in authorization) return authorization.error!;
  const { propertyId, imageId } = await context.params;
  const ownership = await requireOwnedEditableProperty(propertyId, authorization.session.sub);
  if ("error" in ownership) return ownership.error!;
  const image = await propertiesRepository.findOwnedImage(imageId, propertyId, authorization.session.sub);
  if (!image) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON invÃ¡lido" }, { status: 400 }); }
  const parsed = imageUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "ActualizaciÃ³n invÃ¡lida" }, { status: 400 });
  if (parsed.data.isPrimary === false && image.isPrimary) {
    return NextResponse.json({ error: "La propiedad debe conservar una imagen principal" }, { status: 400 });
  }

  try {
    const updated = await runPropertiesTransaction((repository) => repository.updateImage(image.id, propertyId, parsed.data.isPrimary, parsed.data.displayOrder));
    return NextResponse.json({ image: { id: updated.id, isPrimary: updated.isPrimary, displayOrder: updated.displayOrder } });
  } catch (error) {
    console.error("property image update error", error);
    return NextResponse.json({ error: "No se pudo actualizar la imagen" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authorization = await requireLandlord();
  if ("error" in authorization) return authorization.error!;
  const { propertyId, imageId } = await context.params;
  const ownership = await requireOwnedEditableProperty(propertyId, authorization.session.sub);
  if ("error" in ownership) return ownership.error!;
  const image = await propertiesRepository.findOwnedImage(imageId, propertyId, authorization.session.sub);
  if (!image) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

  const { count: imageCount } = await propertiesRepository.imageCountAndHashes(propertyId);
  if (imageCount <= 3) {
    return NextResponse.json({ error: "La propiedad debe conservar al menos 3 imÃ¡genes" }, { status: 409 });
  }

  try {
    await removeStorageFile(PROPERTY_IMAGES_BUCKET, image.storagePath);
    await runPropertiesTransaction((repository) => repository.deleteImageAndPromote(image, propertyId));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("property image delete error", error);
    return NextResponse.json({ error: "No se pudo eliminar la imagen" }, { status: 500 });
  }
}
