import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { loginSchema, toPublicUser } from "@/lib/validations/auth";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { panelPathForRole } from "@/lib/roles";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { identifier, password } = parsed.data;
  const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier.toLowerCase() }, { nationalId: identifier }] } });

  if (!user || !user.active) {
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos" },
      { status: 401 },
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos" },
      { status: 401 },
    );
  }

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: toPublicUser(user),
    redirectTo: panelPathForRole(user.role),
  });
}
