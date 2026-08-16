import { NextResponse } from "next/server";
import { createTextId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { incidentsRepository } from "@/repositories/incidents.server";
import { getActiveSession } from "@/lib/server-auth";

import { z } from "zod";

const incidentReportSchema = z.object({ contractId: z.string().min(1), description: z.string().trim().min(10).max(2000) });

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const reports = await incidentsRepository.list(session.role, session.sub);
  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session || session.role !== "ARRENDATARIO") return NextResponse.json({ error: "Solo un arrendatario puede reportar una incidencia" }, { status: 403 });
  const parsed = incidentReportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const data = parsed.data;
  const incidentDate = new Date();
  const contract = await prisma.contracts.findUnique({ where: { id: data.contractId }, select: { id: true, propertyId: true, tenantId: true, landlordId: true, status: true } });
  if (!contract || contract.tenantId !== session.sub) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  if (contract.status !== "ACTIVO") return NextResponse.json({ error: "Solo puedes reportar incidencias sobre un contrato activo" }, { status: 409 });
  const item = await prisma.incident_reports.create({ data: { id: createTextId(), contractId: contract.id, propertyId: contract.propertyId, tenantId: contract.tenantId, landlordId: contract.landlordId, description: data.description, incidentDate, updatedAt: new Date() } });
  return NextResponse.json({ report: item }, { status: 201 });
}
