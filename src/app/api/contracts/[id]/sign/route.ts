import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { contractsRepository, runContractsTransaction } from "@/repositories/contracts.server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role === "MUNICIPIO") return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const id = (await params).id;
  const contract = await contractsRepository.findById(id);
  if (!contract || (contract.tenantId !== session.sub && contract.landlordId !== session.sub)) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  if (contract.status !== "PENDIENTE_FIRMA") return NextResponse.json({ error: "Este contrato ya fue formalizado" }, { status: 409 });
  try {
    const signed = await runContractsTransaction((repository) => repository.signPendingContract(id, session.sub));
    if (!signed) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    const tenantSigned = Boolean(signed.tenantSignedAt); const landlordSigned = Boolean(signed.landlordSignedAt);
    return NextResponse.json({ awaitingMunicipalReview: tenantSigned && landlordSigned, tenantSigned, landlordSigned });
  } catch (error) {
    if ((error as { code?: string }).code === "40001") return NextResponse.json({ error: "El contrato cambió durante la firma" }, { status: 409 });
    console.error("contract sign error", error);
    return NextResponse.json({ error: "No se pudo firmar el contrato" }, { status: 500 });
  }
}
