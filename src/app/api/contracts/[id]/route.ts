import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { contractUserSelect, toContractUser } from "@/lib/contract-user";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
import { contractDateFields, hasValidContractDateRange, hasValidProvidedContractDateRange } from "@/lib/temporal-state-validation";

const contractSchema = z.object({ city: z.string().trim().max(100).optional(), province: z.string().trim().max(100).optional(), canton: z.string().trim().max(100).optional(), parish: z.string().trim().max(100).optional(), neighborhood: z.string().trim().max(100).optional(), street: z.string().trim().max(160).optional(), houseNumber: z.string().trim().max(50).optional(), intersection: z.string().trim().max(160).optional(), purpose: z.string().trim().max(300).optional(), paymentMethod: z.string().trim().max(300).optional(), monthlyRent: z.coerce.number().positive().max(100000).optional(), depositAmount: z.coerce.number().min(0).max(100000).optional(), ...contractDateFields }).superRefine((data, context) => {
  if (!hasValidProvidedContractDateRange(data.startDate, data.endDate)) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "La fecha final debe ser posterior a la fecha inicial" });
  }
});

async function findAccessible(id: string, userId: string, role: string) {
  const contract = await prisma.contracts.findUnique({ where: { id }, include: { properties: true, users_contracts_tenantIdTousers: { select: contractUserSelect }, users_contracts_landlordIdTousers: { select: contractUserSelect } } });
  if (!contract || (role !== "MUNICIPIO" && contract.tenantId !== userId && contract.landlordId !== userId)) return null;
  return contract;
}

function serializeContractUsers<T extends {
  users_contracts_tenantIdTousers: Parameters<typeof toContractUser>[0];
  users_contracts_landlordIdTousers: Parameters<typeof toContractUser>[0];
}>(contract: T) {
  return {
    ...contract,
    users_contracts_tenantIdTousers: toContractUser(contract.users_contracts_tenantIdTousers),
    users_contracts_landlordIdTousers: toContractUser(contract.users_contracts_landlordIdTousers),
  };
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { const session = await getActiveSession(); if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 }); const contract = await findAccessible((await params).id, session.sub, session.role); return contract ? NextResponse.json({ contract: serializeContractUsers(contract) }) : NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 }); }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession(); if (!session || session.role !== "ARRENDADOR") return NextResponse.json({ error: "Solo el arrendador puede preparar el contrato" }, { status: 403 });
  const parsed = contractSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const contract = await findAccessible((await params).id, session.sub, session.role); if (!contract) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 }); if (contract.status !== "PENDIENTE_FIRMA") return NextResponse.json({ error: "El contrato ya fue formalizado" }, { status: 409 });
  const data = parsed.data;
  const startDate = data.startDate ? new Date(data.startDate) : contract.startDate;
  const endDate = data.endDate ? new Date(data.endDate) : contract.endDate;
  if (!hasValidContractDateRange(startDate, endDate)) return NextResponse.json({ error: "La fecha final debe ser posterior a la fecha inicial" }, { status: 400 });
  const updated = await prisma.contracts.update({ where: { id: contract.id }, data: { ...data, monthlyRent: data.monthlyRent === undefined ? undefined : new Prisma.Decimal(data.monthlyRent), depositAmount: data.depositAmount === undefined ? undefined : new Prisma.Decimal(data.depositAmount), startDate: data.startDate ? startDate : undefined, endDate: data.endDate ? endDate : undefined, updatedAt: new Date() } });
  return NextResponse.json({ contract: updated });
}
