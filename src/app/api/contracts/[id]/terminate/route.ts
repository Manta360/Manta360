import { ContractStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { isContractTransactionConflict, runContractTransaction } from "@/lib/contract-exclusivity";
import { isTerminableContractStatus, reconcileExpiredContracts } from "@/lib/contract-lifecycle";
import { getActiveSession } from "@/lib/server-auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
  if (session.role !== "ARRENDATARIO" && session.role !== "ARRENDADOR") {
    return NextResponse.json({ error: "Solo las partes del contrato pueden finalizarlo" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const result = await runContractTransaction(async (tx) => {
      const now = new Date();
      await reconcileExpiredContracts(tx, now);
      const contract = await tx.contracts.findUnique({
        where: { id },
        select: { id: true, propertyId: true, tenantId: true, landlordId: true, status: true },
      });
      if (!contract) return { error: "Contrato no encontrado", status: 404 };

      const isOwner = session.role === "ARRENDATARIO"
        ? contract.tenantId === session.sub
        : contract.landlordId === session.sub;
      if (!isOwner) return { error: "Contrato no encontrado", status: 404 };
      if (!isTerminableContractStatus(contract.status)) {
        return { error: "El contrato no se puede finalizar en su estado actual", status: 409 };
      }

      const finalized = await tx.contracts.updateMany({
        where: { id: contract.id, status: { in: [ContractStatus.ACTIVO, ContractStatus.EN_RENOVACION] } },
        data: { status: ContractStatus.FINALIZADO, endedAt: now, endedBy: session.sub, updatedAt: now },
      });
      if (finalized.count !== 1) return { error: "El contrato cambio durante la finalizacion", status: 409 };

      await tx.properties.updateMany({
        where: { id: contract.propertyId, status: "OCUPADO" },
        data: { status: "DISPONIBLE", updatedAt: now },
      });
      return { finalized: true };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    if (isContractTransactionConflict(error)) {
      return NextResponse.json({ error: "El contrato cambio durante la finalizacion" }, { status: 409 });
    }
    console.error("contract termination error", error);
    return NextResponse.json({ error: "No se pudo finalizar el contrato de forma segura" }, { status: 500 });
  }
}
