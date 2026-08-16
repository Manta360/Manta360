import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { toPublicUser } from "@/lib/validations/auth";
import { sessionUserRepository } from "@/repositories/session-user.server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let user;
  try {
    user = await sessionUserRepository.findPublicSessionUserById(session.sub);
  } catch (error) {
    console.error("auth me user lookup error", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }

  if (!user || !user.active) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: toPublicUser(user) });
}
