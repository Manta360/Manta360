import { describe, expect, it, vi } from "vitest";
import { ChatRepository, type SqlExecutor } from "@/repositories/chat.repository";

function executorWithRows(rows: unknown[]) {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as SqlExecutor;
}

describe("ChatRepository", () => {
  it("devuelve una conversación vacía y consulta solo al participante indicado", async () => {
    const executor = executorWithRows([]);
    const repository = new ChatRepository(executor);

    await expect(repository.listForParticipant("tenant-1")).resolves.toEqual([]);
    expect(executor.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE message."senderId" = $1 OR message."recipientId" = $1'),
      ["tenant-1"],
    );
  });

  it("preserva el orden del resultado, detalle público y valores de respaldo", async () => {
    const first = new Date("2026-01-01T00:00:00.000Z");
    const second = new Date("2026-01-02T00:00:00.000Z");
    const executor = executorWithRows([
      { id: "message-1", propertyId: "property-1", senderId: "tenant-1", recipientId: "landlord-1", content: "Primero", createdAt: first, readAt: null, property_id: "property-1", property_title: "Casa", property_landlord_id: "landlord-1", sender_name: "Tenant", recipient_name: "Landlord" },
      { id: "message-2", propertyId: "removed-property", senderId: "tenant-1", recipientId: "removed-user", content: "Segundo", createdAt: second, readAt: null, property_id: null, property_title: null, property_landlord_id: null, sender_name: null, recipient_name: null },
    ]);
    const repository = new ChatRepository(executor);

    const messages = await repository.listForParticipant("tenant-1");

    expect(messages.map(({ id }) => id)).toEqual(["message-1", "message-2"]);
    expect(messages[0]?.property).toEqual({ id: "property-1", title: "Casa", landlordId: "landlord-1" });
    expect(messages[1]).toMatchObject({ property: undefined, senderName: "Usuario", recipientName: "Usuario" });
  });

  it("parametriza propiedad, participantes y creación de mensaje", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const executor = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ landlordId: "landlord-1", status: "DISPONIBLE" }] })
      .mockResolvedValueOnce({ rows: [{ id: "message-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "message-2", propertyId: "property-1", senderId: "tenant-1", recipientId: "landlord-1", content: "Hola", createdAt, readAt: null }] }),
    } as unknown as SqlExecutor;
    const repository = new ChatRepository(executor);

    await expect(repository.findPropertyById("property-1")).resolves.toEqual({ landlordId: "landlord-1", status: "DISPONIBLE" });
    await expect(repository.conversationExists("property-1", "tenant-1", "landlord-1")).resolves.toBe(true);
    await expect(repository.createMessage({ id: "message-2", propertyId: "property-1", senderId: "tenant-1", recipientId: "landlord-1", content: "Hola" })).resolves.toMatchObject({ id: "message-2", content: "Hola" });

    expect(executor.query).toHaveBeenNthCalledWith(1, expect.stringContaining("WHERE id = $1"), ["property-1"]);
    expect(executor.query).toHaveBeenNthCalledWith(2, expect.stringContaining('"propertyId" = $1'), ["property-1", "tenant-1", "landlord-1"]);
    expect(executor.query).toHaveBeenNthCalledWith(3, expect.stringContaining("VALUES ($1, $2, $3, $4, $5)"), ["message-2", "property-1", "tenant-1", "landlord-1", "Hola"]);
  });
});
