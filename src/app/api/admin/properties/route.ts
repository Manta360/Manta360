import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { adminPropertiesRepository } from "@/repositories/admin-properties.server";

export async function GET() {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  return NextResponse.json(await adminPropertiesRepository.listForMunicipality());
}
