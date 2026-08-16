import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

export async function GET() {
  const session = await getActiveSession();
  if (!session || (session.role !== "ARRENDATARIO" && session.role !== "ARRENDADOR")) {
    return NextResponse.json({ error: "Sesion no autorizada" }, { status: 403 });
  }
  const contracts = await prisma.contracts.findMany({
    where: session.role === "ARRENDATARIO" ? { tenantId: session.sub } : { landlordId: session.sub },
    select: { id: true, startDate: true, endDate: true, status: true, properties: { select: { id: true, title: true, address: true } } },
  });
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  if (contractById.size === 0) return NextResponse.json({ renewals: [] });
  const renewals = await prisma.contract_renewal_requests.findMany({
    where: { contractId: { in: [...contractById.keys()] } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ renewals: renewals.map((renewal) => ({ ...renewal, contract: contractById.get(renewal.contractId)! })) });
}
