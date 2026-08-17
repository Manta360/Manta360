import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/password";
import { createTextId } from "@/lib/ids";
import { getActiveSession } from "@/lib/server-auth";
import { registerSchema, toPublicUser } from "@/lib/validations/auth";
import { adminUsersRepository } from "@/repositories/admin-users.server";
import type { AdminManagedRole, AdminUser } from "@/repositories/admin-users.repository";

const landlordCreateSchema = registerSchema.extend({
  role: z.literal("ARRENDADOR"),
});

const roleFilterSchema = z.enum(["ARRENDADOR", "ARRENDATARIO"]);

type UserForSerialization = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  nationalId: string | null;
  role: string;
  active: boolean;
  disabledAt: Date | null;
  disabledBy: string | null;
  disableReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeAdminUser(user: UserForSerialization & { propertiesCount?: number }) {
  const { propertiesCount, ...rest } = user;
  const base = {
    ...toPublicUser(rest),
    updatedAt: rest.updatedAt.toISOString(),
    disabledAt: rest.disabledAt?.toISOString() ?? null,
    disabledBy: rest.disabledBy,
    disableReason: rest.disableReason,
  };
  return propertiesCount === undefined ? base : { ...base, propertiesCount };
}

async function municipioSession() {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") return null;
  return session;
}

export async function GET(request: Request) {
  const session = await municipioSession();
  if (!session) {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  const url = new URL(request.url);
  const roleParam = url.searchParams.get("role");
  const search = url.searchParams.get("search")?.trim() || null;
  let role: AdminManagedRole | null = null;
  if (roleParam) {
    const parsedRole = roleFilterSchema.safeParse(roleParam);
    if (!parsedRole.success) {
      return NextResponse.json({ error: "Filtro de rol inválido" }, { status: 400 });
    }
    role = parsedRole.data;
  }

  try {
    const users = await adminUsersRepository.listUsers({ role, search });
    const serialized = users.map((user: AdminUser) => serializeAdminUser(user));
    return NextResponse.json({
      users: serialized,
      // Compatibilidad con consumidores existentes del módulo de arrendadores.
      landlords: serialized.filter((user) => user.role === "ARRENDADOR"),
    });
  } catch (error) {
    console.error("admin users list error", error);
    return NextResponse.json({ error: "No se pudieron obtener los usuarios" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await municipioSession();
  if (!session) {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = landlordCreateSchema.safeParse({
    ...(body && typeof body === "object" ? body : {}),
    role: "ARRENDADOR",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de arrendador inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = parsed.data;
    const landlord = await adminUsersRepository.createLandlord({
      id: createTextId(),
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      nationalId: data.nationalId,
      passwordHash: await hashPassword(data.password),
      updatedAt: new Date(),
    });
    return NextResponse.json({ landlord: serializeAdminUser(landlord) }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo o cédula" }, { status: 409 });
    }
    console.error("admin landlord create error", error);
    return NextResponse.json({ error: "No se pudo crear el arrendador" }, { status: 500 });
  }
}
