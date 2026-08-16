import { NextResponse } from "next/server";
import { z } from "zod";
import { createTextId } from "@/lib/ids";
import { getActiveSession } from "@/lib/server-auth";
import { contractDateFields, hasValidProvidedContractDateRange } from "@/lib/temporal-state-validation";
import { contractRequestsRepository, runContractRequestsTransaction } from "@/repositories/contract-requests.server";

const requestSchema = z.object({ propertyId: z.string().min(1), message: z.string().trim().max(2000).optional(), ...contractDateFields }).superRefine((data, context) => {
  if (!hasValidProvidedContractDateRange(data.startDate, data.endDate)) context.addIssue({ code: "custom", path: ["endDate"], message: "La fecha final debe ser posterior a la fecha inicial" });
});

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const requests = await contractRequestsRepository.listForSession(session.role, session.sub);
  return NextResponse.json({ requests: requests.map((item) => ({ ...item, properties: { ...item.properties, monthlyRent: Number(item.properties.monthlyRent) } })) });
}

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session || session.role !== "ARRENDATARIO") return NextResponse.json({ error: "Solo un arrendatario puede solicitar un contrato" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const data = parsed.data;
  try {
    const result = await runContractRequestsTransaction(async (repository, contracts) => {
      await contracts.reconcileExpiredContracts(new Date());
      if (!await repository.propertyCanReceiveRequest(data.propertyId)) return { error: "La propiedad ya no está disponible", status: 409 };
      if (!await repository.isTenantIdentityReady(session.sub)) return { error: "Debes tener verificados ambos lados de tu cedula o un pasaporte antes de solicitar un contrato", status: 403 };
      if (await repository.hasPendingRequest(data.propertyId, session.sub)) return { error: "Ya tienes una solicitud pendiente para esta propiedad", status: 409 };
      const item = await repository.createRequest({ id: createTextId(), propertyId: data.propertyId, tenantId: session.sub, message: data.message || null, startDate: data.startDate ? new Date(data.startDate) : null, endDate: data.endDate ? new Date(data.endDate) : null });
      return { item };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ request: result.item }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "40001" || (error as { code?: string }).code === "23505") return NextResponse.json({ error: "La disponibilidad de la propiedad cambió durante la solicitud" }, { status: 409 });
    console.error("contract request create error", error);
    return NextResponse.json({ error: "No se pudo crear la solicitud de forma segura" }, { status: 500 });
  }
}
