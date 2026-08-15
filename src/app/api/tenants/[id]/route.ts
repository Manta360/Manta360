import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
import { toPublicUser } from "@/lib/validations/auth";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  fullName: z.string().trim().min(3).max(120).optional(),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  nationalId: z.string().trim().regex(/^\d{10}$/, "La cédula debe tener 10 dígitos").optional(),
  active: z.boolean().optional(),
  reason: z.string().trim().min(10).max(800).optional(),
});

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

function serializeTenant(user: Prisma.UserGetPayload<{ select: typeof tenantSelect }>) {
  return {
    ...toPublicUser(user),
    updatedAt: user.updatedAt.toISOString(),
    disabledAt: user.disabledAt?.toISOString() ?? null,
    disabledBy: user.disabledBy,
    disableReason: user.disableReason,
  };
}

async function findTenant(id: string) {
  return prisma.user.findFirst({ where: { id, role: "ARRENDATARIO" }, select: tenantSelect });
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const { id } = await context.params;
  if (session.role !== "MUNICIPIO" && !(session.role === "ARRENDATARIO" && session.sub === id)) {
    return NextResponse.json({ error: "No tienes permiso para consultar este arrendatario" }, { status: 403 });
  }
  const tenant = await findTenant(id);
  if (!tenant) return NextResponse.json({ error: "Arrendatario no encontrado" }, { status: 404 });
  return NextResponse.json({ tenant: serializeTenant(tenant) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const { id } = await context.params;
  const existing = await findTenant(id);
  if (!existing) return NextResponse.json({ error: "Arrendatario no encontrado" }, { status: 404 });
  const isMunicipio = session.role === "MUNICIPIO";
  const isSelf = session.role === "ARRENDATARIO" && session.sub === id;
  if (!isMunicipio && !isSelf) return NextResponse.json({ error: "No tienes permiso para editar este arrendatario" }, { status: 403 });

  const raw = await request.json().catch(() => null);
  if (raw && typeof raw === "object" && ("role" in raw || "password" in raw)) {
    return NextResponse.json({ error: "El rol y la contraseña no se modifican mediante este endpoint" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Datos de arrendatario inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  if (!isMunicipio && (parsed.data.active !== undefined || parsed.data.reason !== undefined)) {
    return NextResponse.json({ error: "Solo el Municipio puede cambiar el estado de una cuenta" }, { status: 403 });
  }
  if (parsed.data.active === false && !parsed.data.reason && !existing.disableReason) {
    return NextResponse.json({ error: "El motivo de desactivación es obligatorio" }, { status: 400 });
  }

  const { reason, active, ...profile } = parsed.data;
  try {
    const now = new Date();
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...profile,
        ...(isMunicipio && active !== undefined
          ? { active, disabledAt: active ? null : now, disabledBy: active ? null : session.sub, disableReason: active ? null : reason }
          : {}),
      },
      select: tenantSelect,
    });
    return NextResponse.json({ tenant: serializeTenant(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo o cédula" }, { status: 409 });
    }
    console.error("tenant update error", error);
    return NextResponse.json({ error: "No se pudo actualizar el arrendatario" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (session.role !== "MUNICIPIO") return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  const { id } = await context.params;
  const existing = await findTenant(id);
  if (!existing) return NextResponse.json({ error: "Arrendatario no encontrado" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const reason = body && typeof body === "object" && "reason" in body && typeof body.reason === "string" ? body.reason.trim() : "Desactivado por el Municipio";
  if (reason.length < 10 || reason.length > 800) return NextResponse.json({ error: "El motivo debe tener entre 10 y 800 caracteres" }, { status: 400 });

  const now = new Date();
  const user = await prisma.user.update({
    where: { id },
    data: { active: false, disabledAt: now, disabledBy: session.sub, disableReason: reason },
    select: tenantSelect,
  });
  return NextResponse.json({ tenant: serializeTenant(user), message: "Arrendatario desactivado sin eliminar sus relaciones" });
}
