import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getActiveSession } from "@/lib/server-auth";
import { registerSchema, toPublicUser } from "@/lib/validations/auth";
import { adminUsersRepository } from "@/repositories/admin-users.server";

const landlordCreateSchema = registerSchema.extend({
  role: z.literal("ARRENDADOR"),
});

const landlordSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  nationalId: true,
  role: true,
  active: true,
  disabledAt: true,
  disabledBy: true,
  disableReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

type LandlordForSerialization = {
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

function serializeLandlord(user: LandlordForSerialization) {
  return {
    ...toPublicUser(user),
    updatedAt: user.updatedAt.toISOString(),
    disabledAt: user.disabledAt?.toISOString() ?? null,
    disabledBy: user.disabledBy,
    disableReason: user.disableReason,
  };
}

async function municipioSession() {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") return null;
  return session;
}

export async function GET() {
  const session = await municipioSession();
  if (!session) {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  try {
    const landlords = await adminUsersRepository.listLandlords();
    return NextResponse.json({ landlords: landlords.map(({ propertiesCount, ...landlord }) => ({ ...serializeLandlord(landlord), propertiesCount })) });
  } catch (error) {
    console.error("admin landlord list error", error);
    return NextResponse.json({ error: "No se pudieron obtener los arrendadores" }, { status: 500 });
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
    const landlord = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        nationalId: data.nationalId,
        passwordHash: await hashPassword(data.password),
        role: "ARRENDADOR",
      },
      select: landlordSelect,
    });
    return NextResponse.json({ landlord: serializeLandlord(landlord) }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo o cédula" }, { status: 409 });
    }
    console.error("admin landlord create error", error);
    return NextResponse.json({ error: "No se pudo crear el arrendador" }, { status: 500 });
  }
}
