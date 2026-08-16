import { NextResponse } from "next/server";
import { z } from "zod";
import {
  activeContractStatuses,
  isContractTransactionConflict,
  runContractTransaction,
} from "@/lib/contract-exclusivity";
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

  const { id } = await params;
  try {
    const result = await runContractTransaction(async (tx) => {
      const contract = await tx.contracts.findUnique({ where: { id } });
      if (!contract) return { error: "Contrato no encontrado", status: 404 };
      if (contract.status !== "PENDIENTE_MUNICIPIO") {
        return { error: "Este contrato no está pendiente de revisión municipal", status: 409 };
      }

      const now = new Date();
      if (parsed.data.decision === "RECHAZAR") {
        await tx.contracts.update({
          where: { id: contract.id },
          data: {
            status: "RECHAZADO_MUNICIPIO",
            municipalReviewedAt: now,
            municipalReviewedBy: session.sub,
            municipalReviewNotes: parsed.data.notes || null,
            updatedAt: now,
          },
        });
        return { approved: false };
      }

      const property = await tx.properties.findUnique({
        where: { id: contract.propertyId },
        include: {
          users_properties_landlordIdTousers: { select: { active: true } },
        },
      });
      if (!property || !property.approved || property.status !== "DISPONIBLE" || !property.users_properties_landlordIdTousers.active) {
        return { error: "La propiedad ya no está disponible para activar este contrato", status: 409 };
      }

      const activeContract = await tx.contracts.findFirst({
        where: {
          propertyId: contract.propertyId,
          id: { not: contract.id },
          status: { in: [...activeContractStatuses] },
        },
        select: { id: true },
      });
      if (activeContract) return { error: "La propiedad ya tiene un contrato vigente", status: 409 };

      const reservedProperty = await tx.properties.updateMany({
        where: { id: property.id, status: "DISPONIBLE", approved: true },
        data: { status: "OCUPADO", updatedAt: now },
      });
      if (reservedProperty.count !== 1) {
        return { error: "La disponibilidad de la propiedad cambió durante la revisión", status: 409 };
      }

      await tx.contracts.update({
        where: { id: contract.id },
        data: {
          status: "ACTIVO",
          municipalReviewedAt: now,
          municipalReviewedBy: session.sub,
          municipalReviewNotes: parsed.data.notes || null,
          updatedAt: now,
        },
      });
      await tx.contract_requests.updateMany({
        where: { propertyId: contract.propertyId, status: "PENDIENTE" },
        data: { status: "RECHAZADO", updatedAt: now },
      });
      return { approved: true };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    if (isContractTransactionConflict(error)) {
      return NextResponse.json({ error: "La propiedad ya tiene un contrato vigente" }, { status: 409 });
    }
    console.error("municipal contract decision error", error);
    return NextResponse.json({ error: "No se pudo revisar el contrato de forma segura" }, { status: 500 });
  }
}
