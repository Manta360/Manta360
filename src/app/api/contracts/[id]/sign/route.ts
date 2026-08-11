import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role === "MUNICIPIO") return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const contract = await prisma.contracts.findUnique({ where: { id: (await params).id } });
  if (!contract || (contract.tenantId !== session.sub && contract.landlordId !== session.sub)) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  if (contract.status !== "PENDIENTE_FIRMA") return NextResponse.json({ error: "Este contrato ya fue formalizado" }, { status: 409 });
  const now = new Date();
  const signed = await prisma.contracts.update({ where: { id: contract.id }, data: session.sub === contract.tenantId ? { tenantSignedAt: now, updatedAt: now } : { landlordSignedAt: now, updatedAt: now } });
  const tenantSigned = Boolean(signed.tenantSignedAt); const landlordSigned = Boolean(signed.landlordSignedAt);
  if (tenantSigned && landlordSigned) {
    await prisma.contracts.update({ where: { id: signed.id }, data: { status: "PENDIENTE_MUNICIPIO", updatedAt: now } });
  }
  return NextResponse.json({ awaitingMunicipalReview: tenantSigned && landlordSigned, tenantSigned, landlordSigned });
}
