import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/server-auth";
import { contractDateFields, hasValidContractDateRange, hasValidProvidedContractDateRange } from "@/lib/temporal-state-validation";
import { contractsRepository } from "@/repositories/contracts.server";

const contractSchema = z.object({ city: z.string().trim().max(100).optional(), province: z.string().trim().max(100).optional(), canton: z.string().trim().max(100).optional(), parish: z.string().trim().max(100).optional(), neighborhood: z.string().trim().max(100).optional(), street: z.string().trim().max(160).optional(), houseNumber: z.string().trim().max(50).optional(), intersection: z.string().trim().max(160).optional(), purpose: z.string().trim().max(300).optional(), paymentMethod: z.string().trim().max(300).optional(), monthlyRent: z.coerce.number().positive().max(100000).optional(), depositAmount: z.coerce.number().min(0).max(100000).optional(), ...contractDateFields }).superRefine((data, context) => { if (!hasValidProvidedContractDateRange(data.startDate, data.endDate)) context.addIssue({ code: "custom", path: ["endDate"], message: "La fecha final debe ser posterior a la fecha inicial" }); });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { const session = await getActiveSession(); if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 }); const contract = await contractsRepository.findById((await params).id); return contract && (session.role === "MUNICIPIO" || contract.tenantId === session.sub || contract.landlordId === session.sub) ? NextResponse.json({ contract }) : NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 }); }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession(); if (!session || session.role !== "ARRENDADOR") return NextResponse.json({ error: "Solo el arrendador puede preparar el contrato" }, { status: 403 });
  const parsed = contractSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const id = (await params).id; const contract = await contractsRepository.findById(id);
  if (!contract || contract.landlordId !== session.sub) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 }); if (contract.status !== "PENDIENTE_FIRMA") return NextResponse.json({ error: "El contrato ya fue formalizado" }, { status: 409 });
  const data = parsed.data; const startDate = data.startDate ? new Date(data.startDate) : contract.startDate; const endDate = data.endDate ? new Date(data.endDate) : contract.endDate;
  if (!hasValidContractDateRange(startDate, endDate)) return NextResponse.json({ error: "La fecha final debe ser posterior a la fecha inicial" }, { status: 400 });
  try { const updated = await contractsRepository.updatePreparation(id, { ...data, startDate: data.startDate ? startDate : undefined, endDate: data.endDate ? endDate : undefined }); return updated ? NextResponse.json({ contract: updated }) : NextResponse.json({ error: "El contrato ya fue formalizado" }, { status: 409 }); } catch (error) { if ((error as { code?: string }).code === "23514") return NextResponse.json({ error: "La fecha final debe ser posterior a la fecha inicial" }, { status: 400 }); console.error("contract prepare error", error); return NextResponse.json({ error: "No se pudo preparar el contrato" }, { status: 500 }); }
}
