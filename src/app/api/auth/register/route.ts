import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { createTextId } from "@/lib/ids";
import { registerSchema, toPublicUser } from "@/lib/validations/auth";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { panelPathForRole } from "@/lib/roles";
import { sessionUserRepository } from "@/repositories/session-user.server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido" },
      { status: 400 },
    );
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    const passwordHash = await hashPassword(data.password);
    const user = await sessionUserRepository.createRegisteredUser({ id: createTextId(), email: data.email, passwordHash, fullName: data.fullName, phone: data.phone, nationalId: data.nationalId, role: data.role, updatedAt: new Date() });

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });
    await setSessionCookie(token);

    return NextResponse.json(
      {
        user: toPublicUser(user),
        redirectTo: panelPathForRole(user.role),
      },
      { status: 201 },
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese correo o cédula" },
        { status: 409 },
      );
    }
    console.error("register error", error);
    return NextResponse.json(
      { error: "No se pudo crear la cuenta" },
      { status: 500 },
    );
  }
}
