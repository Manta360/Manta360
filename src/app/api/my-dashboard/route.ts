import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { dashboardRepository } from "@/repositories/dashboard.server";

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });

  try {
    const user = await dashboardRepository.findUserById(session.sub);
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (session.role === "ARRENDADOR") {
      const { properties, conversations, documents } = await dashboardRepository.getLandlordCounts(session.sub);
      return NextResponse.json({ user, role: session.role, cards: [{ label: "Mis propiedades", value: properties }, { label: "Mis conversaciones", value: conversations }, { label: "Documentos verificados", value: documents }] });
    }
    if (session.role === "ARRENDATARIO") {
      const { requests, conversations, documents } = await dashboardRepository.getTenantCounts(session.sub);
      return NextResponse.json({ user, role: session.role, cards: [{ label: "Mis solicitudes", value: requests }, { label: "Mis conversaciones", value: conversations }, { label: "Documentos verificados", value: documents }] });
    }
    return NextResponse.json({ user, role: session.role, cards: [] });
  } catch (error) {
    console.error("my dashboard error", error);
    return NextResponse.json({ error: "No se pudo cargar el dashboard" }, { status: 500 });
  }
}
