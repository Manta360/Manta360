import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

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
  const existing = await prisma.properties.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (existing.status === "INHABILITADO") {
    return NextResponse.json({ error: "La propiedad ya está inhabilitada" }, { status: 409 });
  }

  const now = new Date();
  const property = await prisma.properties.update({
    where: { id },
    data: {
      status: "INHABILITADO",
      approved: false,
      approvedAt: null,
      approvedBy: null,
      disabledAt: now,
      disabledBy: session.sub,
      disableReason: parsed.data.reason,
      updatedAt: now,
    },
  });

  return NextResponse.json({
    property: { ...property, monthlyRent: Number(property.monthlyRent) },
  });
}
