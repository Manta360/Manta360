import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveSession: vi.fn(),
  createTextId: vi.fn(),
  listForParticipant: vi.fn(),
  findPropertyById: vi.fn(),
  conversationExists: vi.fn(),
  createMessage: vi.fn(),
  countUnreadForRecipient: vi.fn(),
  markConversationRead: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({ getActiveSession: mocks.getActiveSession }));
vi.mock("@/lib/ids", () => ({ createTextId: mocks.createTextId }));
vi.mock("@/repositories/chat.server", () => ({
  chatRepository: {
    listForParticipant: mocks.listForParticipant,
    findPropertyById: mocks.findPropertyById,
    conversationExists: mocks.conversationExists,
    createMessage: mocks.createMessage,
    countUnreadForRecipient: mocks.countUnreadForRecipient,
    markConversationRead: mocks.markConversationRead,
  },
}));

import { GET, PATCH, POST } from "@/app/api/chat/route";

const tenant = { sub: "tenant-1", email: "tenant@example.test", fullName: "Tenant", role: "ARRENDATARIO" as const };
const landlord = { sub: "landlord-1", email: "landlord@example.test", fullName: "Landlord", role: "ARRENDADOR" as const };

function chatRequest(body: unknown) {
  return new Request("http://localhost/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function markReadRequest(body: unknown) {
  return new Request("http://localhost/api/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("Chat route migrated to PostgreSQL repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTextId.mockReturnValue("message-1");
    mocks.findPropertyById.mockResolvedValue({ landlordId: "landlord-1", status: "DISPONIBLE" });
    mocks.conversationExists.mockResolvedValue(false);
    mocks.createMessage.mockResolvedValue({ id: "message-1", propertyId: "property-1", senderId: "tenant-1", recipientId: "landlord-1", content: "Hola", createdAt: new Date("2026-01-01T00:00:00.000Z"), readAt: null });
  });

  it("exige sesión para listar y devuelve únicamente los mensajes del participante", async () => {
    mocks.getActiveSession.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/api/chat"))).status).toBe(401);

    mocks.getActiveSession.mockResolvedValueOnce(tenant);
    mocks.listForParticipant.mockResolvedValueOnce([]);
    const response = await GET(new Request("http://localhost/api/chat"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ currentUserId: "tenant-1", messages: [] });
    expect(mocks.listForParticipant).toHaveBeenCalledWith("tenant-1");
  });

  it("devuelve un conteo real de no leÃ­dos solo para el destinatario autenticado", async () => {
    mocks.getActiveSession.mockResolvedValue(tenant);
    mocks.countUnreadForRecipient.mockResolvedValue(2);
    const response = await GET(new Request("http://localhost/api/chat?summary=unread"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ unreadCount: 2 });
    expect(mocks.countUnreadForRecipient).toHaveBeenCalledWith("tenant-1");
  });

  it("marca solo la conversaciÃ³n recibida por el usuario autenticado y rechaza usuarios ajenos", async () => {
    mocks.getActiveSession.mockResolvedValue(tenant);
    mocks.markConversationRead.mockResolvedValue(2);
    const response = await PATCH(markReadRequest({ propertyId: "property-1" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ marked: 2 });
    expect(mocks.markConversationRead).toHaveBeenCalledWith("property-1", "tenant-1");

    mocks.getActiveSession.mockResolvedValue(null);
    expect((await PATCH(markReadRequest({ propertyId: "property-1" }))).status).toBe(401);
  });

  it("conserva la validación de payload vacío, destinatario propio y propiedad inexistente", async () => {
    mocks.getActiveSession.mockResolvedValue(tenant);
    expect((await POST(chatRequest({ propertyId: "property-1", recipientId: "landlord-1", content: "   " }))).status).toBe(400);
    expect((await POST(chatRequest({ propertyId: "property-1", recipientId: "tenant-1", content: "Hola" }))).status).toBe(400);
    mocks.findPropertyById.mockResolvedValueOnce(null);
    expect((await POST(chatRequest({ propertyId: "missing", recipientId: "landlord-1", content: "Hola" }))).status).toBe(404);
  });

  it("permite al arrendatario iniciar una conversación válida y conserva payload/respuesta", async () => {
    mocks.getActiveSession.mockResolvedValue(tenant);
    const response = await POST(chatRequest({ propertyId: "property-1", recipientId: "landlord-1", content: "Hola" }));

    expect(response.status).toBe(201);
    expect((await response.json()).message).toMatchObject({ id: "message-1", senderId: "tenant-1", recipientId: "landlord-1", content: "Hola" });
    expect(mocks.createMessage).toHaveBeenCalledWith({ id: "message-1", propertyId: "property-1", senderId: "tenant-1", recipientId: "landlord-1", content: "Hola" });
  });

  it("rechaza remitentes externos, municipio y propiedades no disponibles", async () => {
    mocks.getActiveSession.mockResolvedValue({ ...landlord, sub: "external-landlord" });
    expect((await POST(chatRequest({ propertyId: "property-1", recipientId: "tenant-1", content: "Hola" }))).status).toBe(403);

    mocks.getActiveSession.mockResolvedValue({ ...tenant, role: "MUNICIPIO" });
    expect((await POST(chatRequest({ propertyId: "property-1", recipientId: "landlord-1", content: "Hola" }))).status).toBe(401);

    mocks.getActiveSession.mockResolvedValue(tenant);
    mocks.findPropertyById.mockResolvedValueOnce({ landlordId: "landlord-1", status: "OCUPADO" });
    expect((await POST(chatRequest({ propertyId: "property-1", recipientId: "landlord-1", content: "Hola" }))).status).toBe(409);
  });

  it("permite al propietario responder solo cuando ya existe conversación con el destinatario", async () => {
    mocks.getActiveSession.mockResolvedValue(landlord);
    mocks.conversationExists.mockResolvedValueOnce(true);
    expect((await POST(chatRequest({ propertyId: "property-1", recipientId: "tenant-1", content: "Respuesta" }))).status).toBe(201);
    expect(mocks.conversationExists).toHaveBeenCalledWith("property-1", "tenant-1", "landlord-1");
  });
});
