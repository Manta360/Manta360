import { NextResponse } from "next/server";
import { isContractTransactionConflict, runContractTransaction } from "@/lib/contract-exclusivity";
import { reconcileExpiredContracts } from "@/lib/contract-lifecycle";
import { getActiveSession } from "@/lib/server-auth";

export async function POST() {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") {
    return NextResponse.json({ error: "Solo el Municipio puede reconciliar contratos vencidos" }, { status: 403 });
  }

  try {
    const finalized = await runContractTransaction((tx) => reconcileExpiredContracts(tx));
    return NextResponse.json({ finalized });
  } catch (error) {
    if (isContractTransactionConflict(error)) {
      return NextResponse.json({ error: "La reconciliacion se debe reintentar" }, { status: 409 });
    }
    console.error("contract expiration reconciliation error", error);
    return NextResponse.json({ error: "No se pudo reconciliar contratos vencidos" }, { status: 500 });
  }
}
