import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesion requerida" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { fullName: true, email: true, phone: true, nationalId: true } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (session.role === "ARRENDADOR") {
    const [properties, conversations, documents] = await Promise.all([prisma.properties.count({ where: { landlordId: session.sub } }), prisma.chat_messages.count({ where: { OR: [{ senderId: session.sub }, { recipientId: session.sub }] } }), prisma.identity_documents.count({ where: { userId: session.sub, isCurrent: true, verificationStatus: "VERIFICADO" } })]);
    return NextResponse.json({ user, role: session.role, cards: [{ label: "Mis propiedades", value: properties }, { label: "Mis conversaciones", value: conversations }, { label: "Documentos verificados", value: documents }] });
  }
  if (session.role === "ARRENDATARIO") {
    const [requests, conversations, documents] = await Promise.all([prisma.contract_requests.count({ where: { tenantId: session.sub } }), prisma.chat_messages.count({ where: { OR: [{ senderId: session.sub }, { recipientId: session.sub }] } }), prisma.identity_documents.count({ where: { userId: session.sub, isCurrent: true, verificationStatus: "VERIFICADO" } })]);
    return NextResponse.json({ user, role: session.role, cards: [{ label: "Mis solicitudes", value: requests }, { label: "Mis conversaciones", value: conversations }, { label: "Documentos verificados", value: documents }] });
  }
  return NextResponse.json({ user, role: session.role, cards: [] });
}
