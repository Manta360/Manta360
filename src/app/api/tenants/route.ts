import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
import { hashPassword } from "@/lib/password";
import { registerSchema, toPublicUser } from "@/lib/validations/auth";

const tenantCreateSchema = registerSchema.extend({ role: z.literal("ARRENDATARIO") });

function isMunicipio(session: Awaited<ReturnType<typeof getActiveSession>>): boolean {
  return session?.role === "MUNICIPIO";
}

function serializeTenant(user: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  nationalId: string | null;
  role: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  disabledAt: Date | null;
  disabledBy: string | null;
  disableReason: string | null;
}) {
  return {
    ...toPublicUser(user),
    updatedAt: user.updatedAt.toISOString(),
    disabledAt: user.disabledAt?.toISOString() ?? null,
    disabledBy: user.disabledBy,
    disableReason: user.disableReason,
  };
}

const tenantSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  nationalId: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  disabledAt: true,
  disabledBy: true,
  disableReason: true,
} as const;

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!isMunicipio(session)) return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });

  const tenants = await prisma.user.findMany({
    where: { role: "ARRENDATARIO" },
    select: { ...tenantSelect, _count: { select: { contracts_contracts_tenantIdTousers: true, contract_requests: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    tenants: tenants.map(({ _count, ...tenant }) => ({
      ...serializeTenant(tenant),
      contractsCount: _count.contracts_contracts_tenantIdTousers,
      requestsCount: _count.contract_requests,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!isMunicipio(session)) return NextResponse.json({ error: "Solo el Municipio puede crear arrendatarios desde este módulo" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = tenantCreateSchema.safeParse({ ...(body && typeof body === "object" ? body : {}), role: "ARRENDATARIO" });
  if (!parsed.success) return NextResponse.json({ error: "Datos de arrendatario inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
    const data = parsed.data;
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: await hashPassword(data.password),
        fullName: data.fullName,
        phone: data.phone,
        nationalId: data.nationalId,
        role: "ARRENDATARIO",
      },
      select: tenantSelect,
    });
    return NextResponse.json({ tenant: serializeTenant(user) }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo o cédula" }, { status: 409 });
    }
    console.error("tenant create error", error);
    return NextResponse.json({ error: "No se pudo crear el arrendatario" }, { status: 500 });
  }
}
