import { NextResponse } from "next/server";
import { z } from "zod";
import { createTextId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

const messageSchema = z.object({
  propertyId: z.string().min(1),
  recipientId: z.string().min(1),
  content: z.string().trim().min(1, "Escribe un mensaje").max(2000),
});

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const messages = await prisma.chat_messages.findMany({
    where: { OR: [{ senderId: session.sub }, { recipientId: session.sub }] },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const propertyIds = [...new Set(messages.map((message) => message.propertyId))];
  const userIds = [...new Set(messages.flatMap((message) => [message.senderId, message.recipientId]))];
  const [properties, users] = await Promise.all([
    prisma.properties.findMany({ where: { id: { in: propertyIds } }, select: { id: true, title: true, landlordId: true } }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }),
  ]);
  const propertyMap = new Map(properties.map((property) => [property.id, property]));
  const userMap = new Map(users.map((user) => [user.id, user.fullName]));
  return NextResponse.json({ currentUserId: session.sub, messages: messages.map((message) => ({ ...message, property: propertyMap.get(message.propertyId), senderName: userMap.get(message.senderId) ?? "Usuario", recipientName: userMap.get(message.recipientId) ?? "Usuario" })) });
}

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session || session.role === "MUNICIPIO") return NextResponse.json({ error: "Solo usuarios registrados pueden usar el chat" }, { status: 401 });
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mensaje inválido", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const data = parsed.data;
  if (data.recipientId === session.sub) return NextResponse.json({ error: "No puedes enviarte mensajes a ti mismo" }, { status: 400 });
  const property = await prisma.properties.findUnique({ where: { id: data.propertyId }, select: { landlordId: true, status: true } });
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  const isTenantStarting = session.role === "ARRENDATARIO" && data.recipientId === property.landlordId;
  // The landlord can only answer a tenant who already opened a conversation
  // about one of the landlord's own properties.  The previous predicate
  // accidentally required the tenant to be both sender and recipient.
  const isLandlordReplying = Boolean(
    session.role === "ARRENDADOR" &&
      session.sub === property.landlordId &&
      (await prisma.chat_messages.findFirst({
        where: {
          propertyId: data.propertyId,
          OR: [
            { senderId: data.recipientId, recipientId: session.sub },
            { senderId: session.sub, recipientId: data.recipientId },
          ],
        },
        select: { id: true },
      }))
  );
  if (!isTenantStarting && !isLandlordReplying) return NextResponse.json({ error: "No tienes permiso para esta conversación" }, { status: 403 });
  if (isTenantStarting && property.status !== "DISPONIBLE") return NextResponse.json({ error: "Esta propiedad ya no está disponible" }, { status: 409 });
  const message = await prisma.chat_messages.create({ data: { id: createTextId(), propertyId: data.propertyId, senderId: session.sub, recipientId: data.recipientId, content: data.content } });
  return NextResponse.json({ message }, { status: 201 });
}
