import { NextResponse } from "next/server";
import { createContractPdf } from "@/lib/contract-pdf";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
  const { id } = await params;
  const contract = await prisma.contracts.findUnique({
    where: { id },
    select: {
      id: true, tenantId: true, landlordId: true, status: true, startDate: true, endDate: true, monthlyRent: true, purpose: true, paymentMethod: true,
      properties: { select: { title: true, address: true } },
      users_contracts_landlordIdTousers: { select: { fullName: true, nationalId: true } },
      users_contracts_tenantIdTousers: { select: { fullName: true, nationalId: true } },
    },
  });
  if (!contract || (session.role !== "MUNICIPIO" && contract.tenantId !== session.sub && contract.landlordId !== session.sub)) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  }

  const pdf = createContractPdf({
    ...contract,
    monthlyRent: contract.monthlyRent === null ? null : Number(contract.monthlyRent),
    landlord: contract.users_contracts_landlordIdTousers,
    tenant: contract.users_contracts_tenantIdTousers,
  });
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contrato-${contract.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
