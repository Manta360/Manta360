import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/server-auth";
import { isContractTransactionConflict, runContractTransaction } from "@/lib/contract-exclusivity";
import { synchronizePropertyContractState } from "@/lib/property-contract-state";
import { toPublicUser } from "@/lib/validations/auth";
import { adminUsersRepository } from "@/repositories/admin-users.server";
import { AdminUsersRepository, type AdminLandlordDetail } from "@/repositories/admin-users.repository";

type RouteContext = { params: Promise<{ id: string }> };

const profileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(3).max(120).optional(),
    email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    nationalId: z.string().trim().regex(/^\d{10}$/, "La cédula debe tener 10 dígitos").optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Indica al menos un campo para actualizar");

const disableLandlordSchema = z
  .object({
    active: z.literal(false),
    reason: z.string().trim().min(10).max(800),
  })
  .strict();

const enableLandlordSchema = z
  .object({
    active: z.literal(true),
  })
  .strict();

const landlordUpdateSchema = z.union([
  profileUpdateSchema,
  disableLandlordSchema,
  enableLandlordSchema,
]);

function serializeLandlord(user: AdminLandlordDetail) {
  return {
    ...toPublicUser(user),
    updatedAt: user.updatedAt.toISOString(),
    disabledAt: user.disabledAt?.toISOString() ?? null,
    disabledBy: user.disabledBy,
    disableReason: user.disableReason,
  };
}

function serializeLandlordDetail(user: AdminLandlordDetail) {
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

async function findLandlord(id: string) {
  return adminUsersRepository.findLandlordById(id);
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await municipioSession();
  if (!session) {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  const { id } = await context.params;
  const landlord = await adminUsersRepository.findLandlordById(id);
  if (!landlord) {
    return NextResponse.json({ error: "Arrendador no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ landlord: serializeLandlordDetail(landlord) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await municipioSession();
  if (!session) {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = landlordUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de arrendador inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const existing = await findLandlord(id);
  if (!existing) {
    return NextResponse.json({ error: "Arrendador no encontrado" }, { status: 404 });
  }

  const update = parsed.data;
  try {
    if (!("active" in update)) {
      const landlord = await adminUsersRepository.updateLandlord(id, update);
      if (!landlord) return NextResponse.json({ error: "Arrendador no encontrado" }, { status: 404 });
      return NextResponse.json({ landlord: serializeLandlord(landlord) });
    }

    if (existing.active === update.active) {
      return NextResponse.json(
        { error: update.active ? "El arrendador ya está activo" : "El arrendador ya está inhabilitado" },
        { status: 409 },
      );
    }

    const landlord = await runContractTransaction(async (tx) => {
      const now = new Date();
      const disabling = update.active === false;
      const reason = disabling ? update.reason : null;
      const repository = new AdminUsersRepository(tx);
      const landlord = await repository.updateLandlord(id, { active: update.active, disabledAt: disabling ? now : null, disabledBy: disabling ? session.sub : null, disableReason: reason });
      if (!landlord) throw new Error("Arrendador no encontrado");

      if (disabling) {
        await tx.query('UPDATE public.properties SET status=\'INHABILITADO\'::"PropertyStatus",approved=false,"approvedAt"=NULL,"approvedBy"=NULL,"disabledAt"=$2,"disabledBy"=$3,"disableReason"=$4,"updatedAt"=$2 WHERE "landlordId"=$1',[id,now,session.sub,reason]);
      } else {
        const properties = await tx.query<{id:string}>('SELECT id FROM public.properties WHERE "landlordId"=$1 AND status=\'INHABILITADO\'::"PropertyStatus" FOR UPDATE',[id]);
        await tx.query('UPDATE public.properties SET status=\'DISPONIBLE\'::"PropertyStatus",approved=false,"approvedAt"=NULL,"approvedBy"=NULL,"disabledAt"=NULL,"disabledBy"=NULL,"disableReason"=NULL,"updatedAt"=$2 WHERE "landlordId"=$1 AND status=\'INHABILITADO\'::"PropertyStatus"',[id,now]);
        for (const property of properties.rows) {
          await synchronizePropertyContractState(tx, property.id, now);
        }
      }
      return landlord;
    });

    const serialized = serializeLandlord(landlord);
    return NextResponse.json({ user: serialized, landlord: serialized });
  } catch (error) {
    if (isContractTransactionConflict(error)) {
      return NextResponse.json({ error: "El arrendador cambio durante la actualizacion" }, { status: 409 });
    }
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo o cédula" }, { status: 409 });
    }
    console.error("admin landlord update error", error);
    return NextResponse.json({ error: "No se pudo actualizar el arrendador" }, { status: 500 });
  }
}
