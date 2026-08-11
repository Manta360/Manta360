import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
const schema = z.object({ approved: z.boolean() });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession(); if (!session || session.role !== "MUNICIPIO") return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const property = await prisma.properties.update({ where: { id: (await params).id }, data: { approved: parsed.data.approved, approvedAt: parsed.data.approved ? new Date() : null, approvedBy: parsed.data.approved ? session.sub : null, updatedAt: new Date() } });
  return NextResponse.json({ property });
}
