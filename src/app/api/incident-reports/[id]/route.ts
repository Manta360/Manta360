import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
import { canTransitionIncidentStatus } from "@/lib/temporal-state-validation";

const schema = z.object({ status: z.enum(["PENDIENTE", "EN_PROCESO", "RESUELTO"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "ARRENDADOR") return NextResponse.json({ error: "Solo el arrendador puede actualizar el estado de una queja" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  const { id } = await params;
  const report = await prisma.incident_reports.findUnique({ where: { id }, select: { id: true, landlordId: true, status: true } });
  if (!report || report.landlordId !== session.sub) return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  if (!canTransitionIncidentStatus(report.status, parsed.data.status)) return NextResponse.json({ error: "Transicion de estado de incidencia no permitida" }, { status: 409 });
  const updated = await prisma.incident_reports.update({ where: { id }, data: { status: parsed.data.status, updatedAt: new Date() } });
  return NextResponse.json({ report: updated });
}
