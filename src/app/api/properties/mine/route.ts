import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { serializeMineProperty } from "@/lib/owned-property-pg";
import { propertiesRepository } from "@/repositories/properties.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "SesiÃ³n requerida" }, { status: 401 });
  if (session.role !== "ARRENDADOR") return NextResponse.json({ error: "OperaciÃ³n no permitida" }, { status: 403 });

  try {
    const properties = await propertiesRepository.listMineForLandlord(session.sub);
    return NextResponse.json(
      { properties: await Promise.all(properties.map(serializeMineProperty)) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("owned properties list error", error);
    return NextResponse.json({ error: "No se pudieron cargar tus propiedades" }, { status: 500 });
  }
}
