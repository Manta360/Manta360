import { NextResponse } from "next/server";
import { z } from "zod";
import { createTextId } from "@/lib/ids";
import { getActiveSession } from "@/lib/server-auth";
import { chatRepository } from "@/repositories/chat.server";

const messageSchema = z.object({
  propertyId: z.string().min(1),
  recipientId: z.string().min(1),
  content: z.string().trim().min(1, "Escribe un mensaje").max(2000),
});
const markReadSchema = z.object({ propertyId: z.string().min(1) });

export async function GET(request: Request) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });

  try {
    if (new URL(request.url).searchParams.get("summary") === "unread") {
      const unreadCount = await chatRepository.countUnreadForRecipient(session.sub);
      return NextResponse.json({ unreadCount });
    }
    const messages = await chatRepository.listForParticipant(session.sub);
    return NextResponse.json({ currentUserId: session.sub, messages });
  } catch (error) {
    console.error("chat list error", error);
    return NextResponse.json({ error: "No se pudo cargar el chat" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getActiveSession();
  if (!session || session.role === "MUNICIPIO") return NextResponse.json({ error: "Solo usuarios registrados pueden usar el chat" }, { status: 401 });

  const parsed = markReadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Conversación inválida" }, { status: 400 });

  try {
    const marked = await chatRepository.markConversationRead(parsed.data.propertyId, session.sub);
    return NextResponse.json({ marked });
  } catch (error) {
    console.error("chat mark read error", error);
    return NextResponse.json({ error: "No se pudo actualizar el chat" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session || session.role === "MUNICIPIO") return NextResponse.json({ error: "Solo usuarios registrados pueden usar el chat" }, { status: 401 });

  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mensaje inválido", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const data = parsed.data;
  if (data.recipientId === session.sub) return NextResponse.json({ error: "No puedes enviarte mensajes a ti mismo" }, { status: 400 });

  try {
    const property = await chatRepository.findPropertyById(data.propertyId);
    if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });

    const isTenantStarting = session.role === "ARRENDATARIO" && data.recipientId === property.landlordId;
    const isLandlordReplying = Boolean(
      session.role === "ARRENDADOR" &&
        session.sub === property.landlordId &&
        (await chatRepository.conversationExists(data.propertyId, data.recipientId, session.sub)),
    );
    if (!isTenantStarting && !isLandlordReplying) return NextResponse.json({ error: "No tienes permiso para esta conversación" }, { status: 403 });
    if (isTenantStarting && property.status !== "DISPONIBLE") return NextResponse.json({ error: "Esta propiedad ya no está disponible" }, { status: 409 });

    const message = await chatRepository.createMessage({
      id: createTextId(),
      propertyId: data.propertyId,
      senderId: session.sub,
      recipientId: data.recipientId,
      content: data.content,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("chat send error", error);
    return NextResponse.json({ error: "No se pudo enviar el mensaje" }, { status: 500 });
  }
}
