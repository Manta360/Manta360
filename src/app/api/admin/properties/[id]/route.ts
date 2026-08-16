import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/server-auth";
import { adminPropertiesRepository } from "@/repositories/admin-properties.server";
const schema = z.object({ approved: z.boolean() });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession(); if (!session || session.role !== "MUNICIPIO") return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const property = await adminPropertiesRepository.updateApproval((await params).id, parsed.data.approved, parsed.data.approved ? session.sub : null, new Date());
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  return NextResponse.json({ property });
}
