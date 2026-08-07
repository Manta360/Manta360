import { getSession, type SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function getActiveSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, active: true },
  });

  return user?.active ? session : null;
}
