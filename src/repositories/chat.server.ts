import { applicationPostgres } from "@/lib/postgres-app";
import { ChatRepository } from "@/repositories/chat.repository";

export const chatRepository = new ChatRepository(applicationPostgres);
