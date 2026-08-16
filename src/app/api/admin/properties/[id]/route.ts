import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/server-auth";
import { adminPropertiesRepository } from "@/repositories/admin-properties.server";
import { PROPERTY_IMAGES_BUCKET, createStorageSignedUrl } from "@/lib/supabase/storage";
const schema = z.object({ approved: z.boolean() });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  try {
    const property = await adminPropertiesRepository.findDetailForMunicipality((await params).id);
    if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
    return NextResponse.json({ property: {
      ...property,
      createdAt: property.createdAt.toISOString(), updatedAt: property.updatedAt.toISOString(),
      approvedAt: property.approvedAt?.toISOString() ?? null, disabledAt: property.disabledAt?.toISOString() ?? null,
      users_properties_landlordIdTousers: { ...property.users_properties_landlordIdTousers, disabledAt: property.users_properties_landlordIdTousers.disabledAt?.toISOString() ?? null },
      images: await Promise.all(property.images.map(async (image) => ({ id: image.id, url: await createStorageSignedUrl(PROPERTY_IMAGES_BUCKET, image.storagePath, 3600), isPrimary: image.isPrimary, displayOrder: image.displayOrder }))),
    } }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("admin property detail error", error);
    return NextResponse.json({ error: "No se pudo obtener la propiedad" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession(); if (!session || session.role !== "MUNICIPIO") return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const property = await adminPropertiesRepository.updateApproval((await params).id, parsed.data.approved, parsed.data.approved ? session.sub : null, new Date());
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  return NextResponse.json({ property });
}
