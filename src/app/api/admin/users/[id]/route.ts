import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

const schema = z
  .object({
    active: z.boolean(),
    reason: z.string().trim().min(10).max(800).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.active === false && !data.reason) {
      ctx.addIssue({ code: "custom", message: "El motivo de inhabilitación es obligatorio", path: ["reason"] });
    }
  });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos. Al inhabilitar, el motivo es obligatorio (mín. 10 caracteres)." }, { status: 400 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, active: true },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (user.role !== "ARRENDADOR") {
    return NextResponse.json({ error: "Solo se pueden gestionar cuentas de arrendador" }, { status: 409 });
  }

  const now = new Date();
  const disabling = parsed.data.active === false;
  const enabling = parsed.data.active === true;

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        active: parsed.data.active,
        disabledAt: disabling ? now : null,
        disabledBy: disabling ? session.sub : null,
        disableReason: disabling ? parsed.data.reason! : null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        active: true,
        disabledAt: true,
        disabledBy: true,
        disableReason: true,
      },
    }),
    ...(disabling
      ? [
          prisma.properties.updateMany({
            where: { landlordId: id },
            data: {
              status: "INHABILITADO",
              approved: false,
              approvedAt: null,
              approvedBy: null,
              disabledAt: now,
              disabledBy: session.sub,
              disableReason: parsed.data.reason!,
              updatedAt: now,
            },
          }),
        ]
      : []),
    ...(enabling
      ? [
          prisma.properties.updateMany({
            where: { landlordId: id, status: "INHABILITADO" },
            data: {
              // Vuelve a "Pendiente" de revisión municipal (approved=false + DISPONIBLE)
              status: "DISPONIBLE",
              approved: false,
              approvedAt: null,
              approvedBy: null,
              disabledAt: null,
              disabledBy: null,
              disableReason: null,
              updatedAt: now,
            },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ user: updated });
}
