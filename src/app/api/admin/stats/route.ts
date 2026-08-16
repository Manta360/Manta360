import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { adminStatsRepository } from "@/repositories/admin-stats.server";

export async function GET() {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  try {
    return NextResponse.json(await adminStatsRepository.getStatistics());
  } catch (error) {
    console.error("admin stats error", error);
    return NextResponse.json({ error: "No se pudieron obtener las estadisticas" }, { status: 500 });
  }
}
