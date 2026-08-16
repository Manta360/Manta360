import { ContractStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isContractTransactionConflict, runContractTransaction } from "@/lib/contract-exclusivity";
import { reconcileExpiredContracts } from "@/lib/contract-lifecycle";
import { createTextId } from "@/lib/ids";
import { synchronizePropertyContractState } from "@/lib/property-contract-state";
import { getActiveSession } from "@/lib/server-auth";
import { hasValidContractDateRange, isWithinRenewalWindow } from "@/lib/temporal-state-validation";

const renewalSchema = z.object({ proposedEndDate: z.string().datetime().optional() }).strict();

function defaultProposedEndDate(endDate: Date) {
  const proposed = new Date(endDate);
  proposed.setFullYear(proposed.getFullYear() + 1);
  return proposed;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "ARRENDATARIO") {
    return NextResponse.json({ error: "Solo el arrendatario puede solicitar renovacion" }, { status: 403 });
  }
  const parsed = renewalSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Fecha de renovacion invalida" }, { status: 400 });

  const { id } = await params;
  try {
    const result = await runContractTransaction(async (tx) => {
      const now = new Date();
      await reconcileExpiredContracts(tx, now);
      const contract = await tx.contracts.findUnique({ where: { id } });
      if (!contract || contract.tenantId !== session.sub) return { error: "Contrato no disponible para renovacion", status: 404 };
      if (contract.status !== ContractStatus.ACTIVO) return { error: "El contrato no esta disponible para renovacion", status: 409 };
      if (!isWithinRenewalWindow(contract.endDate, now)) {
        return { error: "La renovacion se habilita durante los ultimos 15 dias de vigencia", status: 409 };
      }

      const proposedEndDate = parsed.data.proposedEndDate ? new Date(parsed.data.proposedEndDate) : defaultProposedEndDate(contract.endDate);
      if (!hasValidContractDateRange(contract.startDate, proposedEndDate) || proposedEndDate.getTime() <= contract.endDate.getTime()) {
        return { error: "La nueva fecha final debe extender el contrato vigente", status: 400 };
      }
      const existing = await tx.contract_renewal_requests.findFirst({
        where: { contractId: contract.id, status: "PENDIENTE" },
        select: { id: true },
      });
      if (existing) return { error: "Ya existe una solicitud de renovacion pendiente", status: 409 };

      const marked = await tx.contracts.updateMany({
        where: { id: contract.id, status: ContractStatus.ACTIVO },
        data: { status: ContractStatus.EN_RENOVACION, updatedAt: now },
      });
      if (marked.count !== 1) return { error: "El contrato cambio durante la solicitud", status: 409 };
      const renewal = await tx.contract_renewal_requests.create({
        data: { id: createTextId(), contractId: contract.id, requestedBy: session.sub, proposedEndDate, updatedAt: now },
      });
      await synchronizePropertyContractState(tx, contract.propertyId, now);
      return { renewal };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isContractTransactionConflict(error)) {
      return NextResponse.json({ error: "La solicitud de renovacion entro en conflicto; intentalo de nuevo" }, { status: 409 });
    }
    console.error("contract renewal request error", error);
    return NextResponse.json({ error: "No se pudo solicitar la renovacion" }, { status: 500 });
  }
}
