import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
import { contractUserSelect, toContractUser } from "@/lib/contract-user";

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const where = session.role === "ARRENDATARIO" ? { tenantId: session.sub } : session.role === "ARRENDADOR" ? { landlordId: session.sub } : {};
  const contracts = await prisma.contracts.findMany({ where, include: { properties: { select: { id: true, title: true, address: true } }, users_contracts_tenantIdTousers: { select: contractUserSelect }, users_contracts_landlordIdTousers: { select: contractUserSelect } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ contracts: contracts.map((contract) => ({ ...contract, users_contracts_tenantIdTousers: toContractUser(contract.users_contracts_tenantIdTousers), users_contracts_landlordIdTousers: toContractUser(contract.users_contracts_landlordIdTousers), monthlyRent: contract.monthlyRent === null ? null : Number(contract.monthlyRent), depositAmount: contract.depositAmount === null ? null : Number(contract.depositAmount) })) });
}
