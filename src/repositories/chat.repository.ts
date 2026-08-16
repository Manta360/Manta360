import type { QueryResultRow } from "pg";

export type ChatMessage = {
  id: string;
  propertyId: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: Date;
  readAt: Date | null;
};

export type ChatMessageWithDetails = ChatMessage & {
  property?: { id: string; title: string; landlordId: string };
  senderName: string;
  recipientName: string;
};

export type ChatProperty = {
  landlordId: string;
  status: string;
};

export type CreateChatMessageInput = {
  id: string;
  propertyId: string;
  senderId: string;
  recipientId: string;
  content: string;
};

export type SqlResult<Row> = { rows: Row[] };

export interface SqlExecutor {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<SqlResult<Row>>;
}

type ChatListRow = ChatMessage & {
  property_id: string | null;
  property_title: string | null;
  property_landlord_id: string | null;
  sender_name: string | null;
  recipient_name: string | null;
};

const LIST_MESSAGES_SQL = `
  SELECT
    message.id,
    message."propertyId",
    message."senderId",
    message."recipientId",
    message.content,
    message."createdAt",
    message."readAt",
    property.id AS property_id,
    property.title AS property_title,
    property."landlordId" AS property_landlord_id,
    sender."fullName" AS sender_name,
    recipient."fullName" AS recipient_name
  FROM public.chat_messages AS message
  LEFT JOIN public.properties AS property ON property.id = message."propertyId"
  LEFT JOIN public.users AS sender ON sender.id = message."senderId"
  LEFT JOIN public.users AS recipient ON recipient.id = message."recipientId"
  WHERE message."senderId" = $1 OR message."recipientId" = $1
  ORDER BY message."createdAt" ASC
  LIMIT 500
`;

export class ChatRepository {
  constructor(private readonly executor: SqlExecutor) {}

  async listForParticipant(participantId: string): Promise<ChatMessageWithDetails[]> {
    const result = await this.executor.query<ChatListRow>(LIST_MESSAGES_SQL, [participantId]);
    return result.rows.map((message) => ({
      id: message.id,
      propertyId: message.propertyId,
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content,
      createdAt: message.createdAt,
      readAt: message.readAt,
      property: message.property_id && message.property_title && message.property_landlord_id
        ? { id: message.property_id, title: message.property_title, landlordId: message.property_landlord_id }
        : undefined,
      senderName: message.sender_name ?? "Usuario",
      recipientName: message.recipient_name ?? "Usuario",
    }));
  }

  async findPropertyById(propertyId: string): Promise<ChatProperty | null> {
    const result = await this.executor.query<ChatProperty>(
      "SELECT \"landlordId\", status FROM public.properties WHERE id = $1 LIMIT 1",
      [propertyId],
    );
    return result.rows[0] ?? null;
  }

  async conversationExists(propertyId: string, firstParticipantId: string, secondParticipantId: string): Promise<boolean> {
    const result = await this.executor.query<{ id: string }>(
      `SELECT id FROM public.chat_messages
       WHERE "propertyId" = $1
         AND (("senderId" = $2 AND "recipientId" = $3) OR ("senderId" = $3 AND "recipientId" = $2))
       LIMIT 1`,
      [propertyId, firstParticipantId, secondParticipantId],
    );
    return Boolean(result.rows[0]);
  }

  async createMessage(input: CreateChatMessageInput): Promise<ChatMessage> {
    const result = await this.executor.query<ChatMessage>(
      `INSERT INTO public.chat_messages (id, "propertyId", "senderId", "recipientId", content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, "propertyId", "senderId", "recipientId", content, "createdAt", "readAt"`,
      [input.id, input.propertyId, input.senderId, input.recipientId, input.content],
    );
    return result.rows[0]!;
  }
}
