import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

const decisionSchema = z.object({
  decision: z.enum(["APROBAR", "RECHAZAR"]),
  notes: z.string().trim().max(800).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") {
    return NextResponse.json({ error: "Solo el Municipio puede revisar contratos" }, { status: 403 });
  }

  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Decisión inválida" }, { status: 400 });

  const contract = await prisma.contracts.findUnique({ where: { id: (await params).id } });
  if (!contract) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  if (contract.status !== "PENDIENTE_MUNICIPIO") {
    return NextResponse.json({ error: "Este contrato no está pendiente de revisión municipal" }, { status: 409 });
  }

  const now = new Date();
  const approved = parsed.data.decision === "APROBAR";
  await prisma.$transaction([
    prisma.contracts.update({
      where: { id: contract.id },
      data: {
        status: approved ? "ACTIVO" : "RECHAZADO_MUNICIPIO",
        municipalReviewedAt: now,
        municipalReviewedBy: session.sub,
        municipalReviewNotes: parsed.data.notes || null,
        updatedAt: now,
      },
    }),
    ...(approved
      ? [
          prisma.properties.update({ where: { id: contract.propertyId }, data: { status: "OCUPADO", updatedAt: now } }),
          prisma.contract_requests.updateMany({ where: { propertyId: contract.propertyId, status: "PENDIENTE" }, data: { status: "RECHAZADO", updatedAt: now } }),
        ]
      : []),
  ]);

  return NextResponse.json({ approved });
}
