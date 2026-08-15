import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { ownedPropertyInclude, serializeOwnedProperty } from "@/lib/owned-property";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "SesiÃ³n requerida" }, { status: 401 });
  if (session.role !== "ARRENDADOR") return NextResponse.json({ error: "OperaciÃ³n no permitida" }, { status: 403 });

  try {
    const properties = await prisma.properties.findMany({
      where: { landlordId: session.sub },
      include: ownedPropertyInclude,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      { properties: await Promise.all(properties.map(serializeOwnedProperty)) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("owned properties list error", error);
    return NextResponse.json({ error: "No se pudieron cargar tus propiedades" }, { status: 500 });
  }
}
