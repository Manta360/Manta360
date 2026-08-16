import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { contractsRepository, isPostgresContractTransactionConflict, reconcileExpiredContractsWithPostgres } from "@/repositories/contracts.server";

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  try {
    await reconcileExpiredContractsWithPostgres();
  } catch (error) {
    if (isPostgresContractTransactionConflict(error)) return NextResponse.json({ error: "La reconciliacion se debe reintentar" }, { status: 409 });
    console.error("contract list expiration reconciliation error", error);
    return NextResponse.json({ error: "No se pudieron reconciliar contratos vencidos" }, { status: 500 });
  }
  const contracts = await contractsRepository.listForSession(session.role, session.sub);
  return NextResponse.json({ contracts: contracts.map((contract) => ({ ...contract, monthlyRent: contract.monthlyRent === null ? null : Number(contract.monthlyRent), depositAmount: contract.depositAmount === null ? null : Number(contract.depositAmount) })) });
}
