import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { contractRenewalsRepository } from "@/repositories/contract-renewals.server";

export async function GET() {
  const session = await getActiveSession();
  if (!session || (session.role !== "ARRENDATARIO" && session.role !== "ARRENDADOR")) {
    return NextResponse.json({ error: "Sesion no autorizada" }, { status: 403 });
  }
  try {
    const renewals = await contractRenewalsRepository.listForSession(session.role, session.sub);
    return NextResponse.json({ renewals });
  } catch (error) {
    console.error("contract renewals list error", error);
    return NextResponse.json({ error: "No se pudieron obtener las renovaciones" }, { status: 500 });
  }
}
