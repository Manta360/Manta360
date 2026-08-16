import { NextResponse } from "next/server";
import { z } from "zod";
import { incidentsRepository } from "@/repositories/incidents.server";
import { getActiveSession } from "@/lib/server-auth";
import { canTransitionIncidentStatus } from "@/lib/temporal-state-validation";

const schema = z.object({ status: z.enum(["PENDIENTE", "EN_PROCESO", "RESUELTO"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "ARRENDADOR") return NextResponse.json({ error: "Solo el arrendador puede actualizar el estado de una queja" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  const { id } = await params;
  const report = await incidentsRepository.findForLandlord(id, session.sub);
  if (!report) return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  if (!canTransitionIncidentStatus(report.status, parsed.data.status)) return NextResponse.json({ error: "Transicion de estado de incidencia no permitida" }, { status: 409 });
  const updated = await incidentsRepository.updateStatus(report.id, parsed.data.status, new Date());
  return NextResponse.json({ report: updated });
}
