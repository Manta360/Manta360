import { NextResponse } from "next/server";
import { z } from "zod";
import { activeContractStatuses, isContractTransactionConflict, runContractTransaction } from "@/lib/contract-exclusivity";
import { createTextId } from "@/lib/ids";
import { getActiveSession } from "@/lib/server-auth";

const schema = z.object({ decision: z.enum(["APROBADO", "RECHAZADO"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "ARRENDADOR") return NextResponse.json({ error: "Solo el arrendador puede resolver solicitudes" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Decisión inválida" }, { status: 400 });

  const { id } = await params;
  try {
    const result = await runContractTransaction(async (tx) => {
      const item = await tx.contract_requests.findUnique({
        where: { id },
        include: {
          properties: {
            include: {
              users_properties_landlordIdTousers: { select: { active: true } },
            },
          },
        },
      });

      if (!item || item.properties.landlordId !== session.sub) return { error: "Solicitud no encontrada", status: 404 };
      if (item.status !== "PENDIENTE") return { error: "Esta solicitud ya fue procesada", status: 409 };

      const now = new Date();
      if (parsed.data.decision === "RECHAZADO") {
        const updated = await tx.contract_requests.update({ where: { id }, data: { status: "RECHAZADO", updatedAt: now } });
        return { updated, contractId: null };
      }

      if (!item.properties.approved || item.properties.status !== "DISPONIBLE" || !item.properties.users_properties_landlordIdTousers.active) {
        return { error: "La propiedad ya no está disponible para contratación", status: 409 };
      }

      const incompatibleContract = await tx.contracts.findFirst({
        where: { propertyId: item.propertyId, status: { in: [...activeContractStatuses] } },
        select: { id: true },
      });
      if (incompatibleContract) return { error: "La propiedad ya tiene un contrato vigente", status: 409 };

      const updated = await tx.contract_requests.update({ where: { id }, data: { status: "APROBADO", updatedAt: now } });
      const contractId = createTextId();
      const startDate = item.startDate ?? now;
      const endDate = item.endDate ?? new Date(new Date(startDate).setFullYear(startDate.getFullYear() + 1));
      await tx.contracts.create({
        data: {
          id: contractId,
          propertyId: item.propertyId,
          tenantId: item.tenantId,
          landlordId: session.sub,
          startDate,
          endDate,
          status: "PENDIENTE_FIRMA",
          monthlyRent: item.properties.monthlyRent,
          city: "Manta",
          purpose: "Vivienda",
          updatedAt: now,
        },
      });
      return { updated, contractId };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    // The property stays in the catalog until municipal approval activates the contract.
    return NextResponse.json(result);
  } catch (error) {
    if (isContractTransactionConflict(error)) {
      return NextResponse.json({ error: "La disponibilidad de la propiedad cambió durante la aceptación" }, { status: 409 });
    }
    console.error("contract request decision error", error);
    return NextResponse.json({ error: "No se pudo resolver la solicitud de forma segura" }, { status: 500 });
  }
}
