import { ContractStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isContractTransactionConflict, runContractTransaction } from "@/lib/contract-exclusivity";
import { reconcileExpiredContracts } from "@/lib/contract-lifecycle";
import { synchronizePropertyContractState } from "@/lib/property-contract-state";
import { getActiveSession } from "@/lib/server-auth";
import { hasValidContractDateRange } from "@/lib/temporal-state-validation";

const decisionSchema = z.object({ decision: z.enum(["APROBAR", "RECHAZAR"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "ARRENDADOR") return NextResponse.json({ error: "Solo el arrendador puede decidir renovaciones" }, { status: 403 });
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Decision invalida" }, { status: 400 });

  const { id } = await params;
  try {
    const result = await runContractTransaction(async (tx) => {
      const now = new Date();
      await reconcileExpiredContracts(tx, now);
      const renewal = await tx.contract_renewal_requests.findUnique({ where: { id } });
      if (!renewal || renewal.status !== "PENDIENTE") return { error: "Solicitud de renovacion no encontrada", status: 404 };
      const contract = await tx.contracts.findUnique({ where: { id: renewal.contractId } });
      if (!contract || contract.landlordId !== session.sub || contract.tenantId !== renewal.requestedBy) {
        return { error: "Solicitud de renovacion no encontrada", status: 404 };
      }
      if (contract.status !== ContractStatus.EN_RENOVACION && contract.status !== ContractStatus.ACTIVO) {
        return { error: "El contrato ya no puede renovarse", status: 409 };
      }

      if (parsed.data.decision === "RECHAZAR") {
        await tx.contract_renewal_requests.update({ where: { id: renewal.id }, data: { status: "RECHAZADO", updatedAt: now } });
        await tx.contracts.updateMany({
          where: { id: contract.id, status: ContractStatus.EN_RENOVACION },
          data: { status: ContractStatus.ACTIVO, updatedAt: now },
        });
        await synchronizePropertyContractState(tx, contract.propertyId, now);
        return { approved: false };
      }

      if (!hasValidContractDateRange(contract.startDate, renewal.proposedEndDate) || renewal.proposedEndDate.getTime() <= contract.endDate.getTime()) {
        return { error: "La fecha propuesta ya no es una extension valida", status: 409 };
      }
      const updated = await tx.contracts.updateMany({
        where: { id: contract.id, status: { in: [ContractStatus.ACTIVO, ContractStatus.EN_RENOVACION] }, endDate: contract.endDate },
        data: { endDate: renewal.proposedEndDate, status: ContractStatus.ACTIVO, updatedAt: now },
      });
      if (updated.count !== 1) return { error: "El contrato cambio durante la aprobacion", status: 409 };
      await tx.contract_renewal_requests.update({ where: { id: renewal.id }, data: { status: "APROBADO", updatedAt: now } });
      await synchronizePropertyContractState(tx, contract.propertyId, now);
      return { approved: true, endDate: renewal.proposedEndDate };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    if (isContractTransactionConflict(error)) return NextResponse.json({ error: "La renovacion entro en conflicto; intentalo de nuevo" }, { status: 409 });
    console.error("contract renewal decision error", error);
    return NextResponse.json({ error: "No se pudo decidir la renovacion" }, { status: 500 });
  }
}
