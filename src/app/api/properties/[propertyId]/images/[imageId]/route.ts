import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { PROPERTY_IMAGES_BUCKET, removeStorageFile } from "@/lib/supabase/storage";

type RouteContext = { params: Promise<{ propertyId: string; imageId: string }> };
const imageUpdateSchema = z.object({ isPrimary: z.boolean().optional(), displayOrder: z.number().int().min(0).max(1000).optional() }).refine((value) => value.isPrimary !== undefined || value.displayOrder !== undefined);

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (session.role !== "ARRENDADOR") return NextResponse.json({ error: "Operación no permitida" }, { status: 403 });
  const { propertyId, imageId } = await context.params;
  const image = await prisma.property_images.findFirst({ where: { id: imageId, propertyId, properties: { landlordId: session.sub } } });
  if (!image) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const parsed = imageUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Actualización inválida" }, { status: 400 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.isPrimary === true) await tx.property_images.updateMany({ where: { propertyId }, data: { isPrimary: false } });
      return tx.property_images.update({ where: { id: image.id }, data: parsed.data });
    });
    return NextResponse.json({ image: { id: updated.id, isPrimary: updated.isPrimary, displayOrder: updated.displayOrder } });
  } catch (error) {
    console.error("property image update error", error);
    return NextResponse.json({ error: "No se pudo actualizar la imagen" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (session.role !== "ARRENDADOR") return NextResponse.json({ error: "Operación no permitida" }, { status: 403 });
  const { propertyId, imageId } = await context.params;
  const image = await prisma.property_images.findFirst({ where: { id: imageId, propertyId, properties: { landlordId: session.sub } } });
  if (!image) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

  try {
    await removeStorageFile(PROPERTY_IMAGES_BUCKET, image.storagePath);
    await prisma.property_images.delete({ where: { id: image.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("property image delete error", error);
    return NextResponse.json({ error: "No se pudo eliminar la imagen" }, { status: 500 });
  }
}
