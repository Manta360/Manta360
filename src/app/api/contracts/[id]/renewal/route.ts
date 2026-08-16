import { NextResponse } from "next/server";
import { createTextId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
import { isWithinRenewalWindow } from "@/lib/temporal-state-validation";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "ARRENDATARIO") return NextResponse.json({ error: "Solo el arrendatario puede solicitar renovación" }, { status: 403 });
  const contract = await prisma.contracts.findUnique({ where: { id: (await params).id } });
  if (!contract || contract.tenantId !== session.sub || contract.status !== "ACTIVO") return NextResponse.json({ error: "Contrato no disponible para renovación" }, { status: 404 });
  if (!isWithinRenewalWindow(contract.endDate)) return NextResponse.json({ error: "La renovación se habilita durante los últimos 15 días de vigencia" }, { status: 409 });
  const exists = await prisma.contract_renewal_requests.findFirst({ where: { contractId: contract.id, status: "PENDIENTE" } });
  if (exists) return NextResponse.json({ error: "Ya existe una solicitud de renovación pendiente" }, { status: 409 });
  const proposedEndDate = new Date(contract.endDate); proposedEndDate.setFullYear(proposedEndDate.getFullYear() + 1);
  const renewal = await prisma.contract_renewal_requests.create({ data: { id: createTextId(), contractId: contract.id, requestedBy: session.sub, proposedEndDate, updatedAt: new Date() } });
  return NextResponse.json({ renewal }, { status: 201 });
}
