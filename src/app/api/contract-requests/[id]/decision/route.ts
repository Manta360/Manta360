import { NextResponse } from "next/server";
import { z } from "zod";
import { createTextId } from "@/lib/ids";
import { getActiveSession } from "@/lib/server-auth";
import { hasValidContractDateRange } from "@/lib/temporal-state-validation";
import { runContractRequestsTransaction } from "@/repositories/contract-requests.server";

const schema = z.object({ decision: z.enum(["APROBADO", "RECHAZADO"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "ARRENDADOR") return NextResponse.json({ error: "Solo el arrendador puede resolver solicitudes" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Decisión inválida" }, { status: 400 });
  const { id } = await params;
  try {
    const result = await runContractRequestsTransaction(async (repository, contracts) => {
      await contracts.reconcileExpiredContracts(new Date());
      const item = await repository.findForLandlordDecision(id, session.sub);
      if (!item) return { error: "Solicitud no encontrada", status: 404 };
      if (item.status !== "PENDIENTE") return { error: "Esta solicitud ya fue procesada", status: 409 };
      if (parsed.data.decision === "RECHAZADO") return { updated: await repository.setDecision(id, "RECHAZADO"), contractId: null };
      if (!item.propertyApproved || item.propertyStatus !== "DISPONIBLE" || !item.propertyActive) return { error: "La propiedad ya no está disponible para contratación", status: 409 };
      if (await repository.hasEffectiveContract(item.propertyId)) return { error: "La propiedad ya tiene un contrato vigente", status: 409 };
      const now = new Date();
      const startDate = item.startDate ?? now;
      const endDate = item.endDate ?? new Date(new Date(startDate).setFullYear(startDate.getFullYear() + 1));
      if (!hasValidContractDateRange(startDate, endDate)) return { error: "La solicitud contiene un periodo contractual invalido", status: 409 };
      const updated = await repository.setDecision(id, "APROBADO");
      const contractId = createTextId();
      await repository.createPendingContract({ id: contractId, propertyId: item.propertyId, tenantId: item.tenantId, landlordId: session.sub, startDate, endDate, monthlyRent: item.monthlyRent });
      return { updated, contractId };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    if ((error as { code?: string }).code === "40001" || (error as { code?: string }).code === "23505") return NextResponse.json({ error: "La disponibilidad de la propiedad cambió durante la aceptación" }, { status: 409 });
    console.error("contract request decision error", error);
    return NextResponse.json({ error: "No se pudo resolver la solicitud de forma segura" }, { status: 500 });
  }
}
