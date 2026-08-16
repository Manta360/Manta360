import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/server-auth";
import { adminPropertiesRepository } from "@/repositories/admin-properties.server";

const schema = z.object({
  reason: z.string().trim().min(10).max(800),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "El motivo de inhabilitación es obligatorio (mín. 10 caracteres)." }, { status: 400 });
  }

  const { id } = await params;
  const existing = await adminPropertiesRepository.findPropertyStatus(id);
  if (!existing) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (existing.status === "INHABILITADO") {
    return NextResponse.json({ error: "La propiedad ya está inhabilitada" }, { status: 409 });
  }

  const now = new Date();
  const property = await adminPropertiesRepository.disableProperty(id, session.sub, parsed.data.reason, now);
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

  return NextResponse.json({
    property: { ...property, monthlyRent: Number(property.monthlyRent) },
  });
}
