import { NextResponse } from "next/server";
import { isContractTransactionConflict, runContractTransaction } from "@/lib/contract-exclusivity";
import { isTerminableContractStatus, reconcileExpiredContracts } from "@/lib/contract-lifecycle";
import { synchronizePropertyContractState } from "@/lib/property-contract-state";
import { getActiveSession } from "@/lib/server-auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession(); if (!session) return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
  if (session.role !== "ARRENDATARIO" && session.role !== "ARRENDADOR") return NextResponse.json({ error: "Solo las partes del contrato pueden finalizarlo" }, { status: 403 });
  const id = (await params).id;
  try {
    const result = await runContractTransaction(async (client) => {
      const now = new Date(); await reconcileExpiredContracts(client, now);
      const row = await client.query<{ id: string; propertyId: string; tenantId: string; landlordId: string; status: string }>('SELECT id,"propertyId","tenantId","landlordId",status FROM public.contracts WHERE id = $1 FOR UPDATE', [id]); const contract = row.rows[0];
      if (!contract || (session.role === "ARRENDATARIO" ? contract.tenantId !== session.sub : contract.landlordId !== session.sub)) return { error: "Contrato no encontrado", status: 404 };
      if (!isTerminableContractStatus(contract.status)) return { error: "El contrato no se puede finalizar en su estado actual", status: 409 };
      const finalized = await client.query('UPDATE public.contracts SET status = \'FINALIZADO\'::"ContractStatus","endedAt" = $2,"endedBy" = $3,"updatedAt" = $2 WHERE id = $1 AND status IN (\'ACTIVO\',\'EN_RENOVACION\')', [id, now, session.sub]);
      if (finalized.rowCount !== 1) return { error: "El contrato cambio durante la finalizacion", status: 409 };
      await synchronizePropertyContractState(client, contract.propertyId, now); return { finalized: true };
    });
    return "error" in result ? NextResponse.json({ error: result.error }, { status: result.status }) : NextResponse.json(result);
  } catch (error) { if (isContractTransactionConflict(error)) return NextResponse.json({ error: "El contrato cambio durante la finalizacion" }, { status: 409 }); console.error("contract termination error", error); return NextResponse.json({ error: "No se pudo finalizar el contrato de forma segura" }, { status: 500 }); }
}
