import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
import { contractUserSelect, toContractUser } from "@/lib/contract-user";
import { isContractTransactionConflict, runContractTransaction } from "@/lib/contract-exclusivity";
import { reconcileExpiredContracts } from "@/lib/contract-lifecycle";

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  try {
    await runContractTransaction((tx) => reconcileExpiredContracts(tx));
  } catch (error) {
    if (isContractTransactionConflict(error)) return NextResponse.json({ error: "La reconciliacion se debe reintentar" }, { status: 409 });
    console.error("contract list expiration reconciliation error", error);
    return NextResponse.json({ error: "No se pudieron reconciliar contratos vencidos" }, { status: 500 });
  }
  const where = session.role === "ARRENDATARIO" ? { tenantId: session.sub } : session.role === "ARRENDADOR" ? { landlordId: session.sub } : {};
  const contracts = await prisma.contracts.findMany({ where, include: { properties: { select: { id: true, title: true, address: true } }, users_contracts_tenantIdTousers: { select: contractUserSelect }, users_contracts_landlordIdTousers: { select: contractUserSelect } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ contracts: contracts.map((contract) => ({ ...contract, users_contracts_tenantIdTousers: toContractUser(contract.users_contracts_tenantIdTousers), users_contracts_landlordIdTousers: toContractUser(contract.users_contracts_landlordIdTousers), monthlyRent: contract.monthlyRent === null ? null : Number(contract.monthlyRent), depositAmount: contract.depositAmount === null ? null : Number(contract.depositAmount) })) });
}
