import { getSession, type SessionPayload } from "@/lib/session";
import { sessionUserRepository } from "@/repositories/session-user.server";

export async function getActiveSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await sessionUserRepository.findActiveSessionUserById(session.sub);

  return user?.active ? session : null;
}
