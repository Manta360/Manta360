import { NextResponse } from "next/server";
import { z } from "zod";
import { createTextId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

const schema = z.object({ decision: z.enum(["APROBADO", "RECHAZADO"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "ARRENDADOR") return NextResponse.json({ error: "Solo el arrendador puede resolver solicitudes" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Decisión inválida" }, { status: 400 });
  const { id } = await params;
  const item = await prisma.contract_requests.findUnique({ where: { id }, include: { properties: true } });
  if (!item || item.properties.landlordId !== session.sub) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  if (item.status !== "PENDIENTE") return NextResponse.json({ error: "Esta solicitud ya fue procesada" }, { status: 409 });
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.contract_requests.update({ where: { id }, data: { status: parsed.data.decision, updatedAt: new Date() } });
    let contractId: string | null = null;
    if (parsed.data.decision === "APROBADO") {
      contractId = createTextId();
      const startDate = item.startDate ?? new Date();
      const endDate = item.endDate ?? new Date(new Date(startDate).setFullYear(startDate.getFullYear() + 1));
      await tx.contracts.create({ data: { id: contractId, propertyId: item.propertyId, tenantId: item.tenantId, landlordId: session.sub, startDate, endDate, status: "PENDIENTE_FIRMA", monthlyRent: item.properties.monthlyRent, city: "Manta", purpose: "Vivienda" , updatedAt: new Date() } });
    }
    return { updated, contractId };
  });
  // La propiedad sigue en catálogo y disponible hasta que ambas partes formalicen el contrato.
  return NextResponse.json(result);
}
