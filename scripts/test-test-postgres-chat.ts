import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { ChatRepository, type SqlExecutor } from "../src/repositories/chat.repository";

const EXPECTED_TEST_PROJECT_REF = "ycerwszvzkmyisflxkpe";

function assertTemporaryProject() {
  if (testPostgresConfig.user !== `postgres.${EXPECTED_TEST_PROJECT_REF}`) {
    throw new Error("El usuario configurado no corresponde a la base temporal manta360prueba");
  }
}

async function main() {
  assertTemporaryProject();
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") {
      throw new Error("La sesión activa no coincide con la base temporal configurada");
    }

    await client.query("BEGIN");
    await client.query("INSERT INTO public.users (id, email, \"passwordHash\", \"fullName\", role, \"updatedAt\") VALUES ($1, $2, $3, $4, 'ARRENDADOR', CURRENT_TIMESTAMP), ($5, $6, $3, $7, 'ARRENDATARIO', CURRENT_TIMESTAMP), ($8, $9, $3, $10, 'ARRENDATARIO', CURRENT_TIMESTAMP)", ["chat-landlord", "chat-landlord@example.test", "hash", "Landlord", "chat-tenant", "chat-tenant@example.test", "Tenant", "chat-external", "chat-external@example.test", "External"]);
    await client.query("INSERT INTO public.properties (id, \"landlordId\", title, address, \"monthlyRent\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)", ["chat-property", "chat-landlord", "Property", "Address", 100]);

    const repository = new ChatRepository(client as unknown as SqlExecutor);
    const empty = await repository.listForParticipant("chat-tenant");
    if (empty.length !== 0) throw new Error("La conversación inicial debía estar vacía");

    const created = await repository.createMessage({ id: "chat-message-1", propertyId: "chat-property", senderId: "chat-tenant", recipientId: "chat-landlord", content: "Hola" });
    if (created.senderId !== "chat-tenant" || created.recipientId !== "chat-landlord" || created.content !== "Hola") {
      throw new Error("El mensaje creado no conservó el contrato esperado");
    }
    await client.query("INSERT INTO public.chat_messages (id, \"propertyId\", \"senderId\", \"recipientId\", content, \"createdAt\") VALUES ($1, $2, $3, $4, $5, $6)", ["chat-message-2", "chat-property", "chat-landlord", "chat-tenant", "Respuesta", "2099-01-01T00:00:00.000Z"]);

    const messages = await repository.listForParticipant("chat-tenant");
    if (messages.map(({ id }) => id).join("|") !== "chat-message-1|chat-message-2") throw new Error("El listado no conservó el orden cronológico");
    if (messages[0]?.property?.landlordId !== "chat-landlord" || messages[0]?.senderName !== "Tenant") throw new Error("El detalle de conversación no conservó sus datos públicos");
    if (await repository.listForParticipant("chat-external").then((items) => items.length !== 0)) throw new Error("Un usuario externo pudo leer una conversación ajena");
    if (!(await repository.conversationExists("chat-property", "chat-tenant", "chat-landlord"))) throw new Error("No se detectó la conversación válida tenant-arrendador");
    if (await repository.conversationExists("chat-property", "chat-external", "chat-landlord")) throw new Error("Un usuario externo pudo acceder a una conversación ajena");

    await client.query("ROLLBACK");
    console.log("POSTGRES CHAT INTEGRATION: OK");
    console.log("empty_conversation: OK");
    console.log("create_and_list: OK");
    console.log("chronological_order: OK");
    console.log("tenant_landlord_participants: OK");
    console.log("external_participant_blocked: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Chat integration test failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.end();
  });
