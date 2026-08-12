import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.properties.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (existing.status !== "INHABILITADO") {
    return NextResponse.json({ error: "La propiedad no está inhabilitada" }, { status: 409 });
  }

  const now = new Date();
  const property = await prisma.properties.update({
    where: { id },
    data: {
      // Vuelve a "Pendiente" de revisión municipal (approved=false + DISPONIBLE)
      status: "DISPONIBLE",
      approved: false,
      approvedAt: null,
      approvedBy: null,
      disabledAt: null,
      disabledBy: null,
      disableReason: null,
      updatedAt: now,
    },
  });

  return NextResponse.json({
    property: { ...property, monthlyRent: Number(property.monthlyRent) },
  });
}
