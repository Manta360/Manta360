import { NextResponse } from "next/server";
import { z } from "zod";
import { createTextId } from "@/lib/ids";
import { isContractTransactionConflict, runContractTransaction } from "@/lib/contract-exclusivity";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
import { contractUserSelect, toContractUser } from "@/lib/contract-user";
import { contractDateFields, hasValidProvidedContractDateRange } from "@/lib/temporal-state-validation";
import { reconcileExpiredContracts } from "@/lib/contract-lifecycle";

const requestSchema = z.object({ propertyId: z.string().min(1), message: z.string().trim().max(2000).optional(), ...contractDateFields }).superRefine((data, context) => {
  if (!hasValidProvidedContractDateRange(data.startDate, data.endDate)) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "La fecha final debe ser posterior a la fecha inicial" });
  }
});

export async function GET() {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const where = session.role === "ARRENDATARIO" ? { tenantId: session.sub } : session.role === "ARRENDADOR" ? { properties: { landlordId: session.sub } } : {};
  const requests = await prisma.contract_requests.findMany({ where, include: { properties: { select: { id: true, title: true, address: true, monthlyRent: true, landlordId: true } }, users: { select: contractUserSelect } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ requests: requests.map((item) => ({ ...item, users: toContractUser(item.users), properties: { ...item.properties, monthlyRent: Number(item.properties.monthlyRent) } })) });
}

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session || session.role !== "ARRENDATARIO") return NextResponse.json({ error: "Solo un arrendatario puede solicitar un contrato" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const data = parsed.data;
  try {
    const result = await runContractTransaction(async (tx) => {
      await reconcileExpiredContracts(tx);
      const [property, verifiedDocuments] = await Promise.all([
        tx.properties.findUnique({
          where: { id: data.propertyId },
          include: { users_properties_landlordIdTousers: { select: { active: true } } },
        }),
        tx.identity_documents.findMany({ where: { userId: session.sub, isCurrent: true, verificationStatus: "VERIFICADO" }, select: { documentType: true, side: true } }),
      ]);
      if (!property || !property.approved || property.status !== "DISPONIBLE" || !property.users_properties_landlordIdTousers.active) return { error: "La propiedad ya no está disponible", status: 409 };

      const verifiedSides = new Set(verifiedDocuments.filter((document) => document.documentType === "CEDULA").map((document) => document.side));
      const identityReady = verifiedDocuments.some((document) => document.documentType === "PASAPORTE") || (verifiedSides.has("FRENTE") && verifiedSides.has("REVERSO"));
      if (!identityReady) return { error: "Debes tener verificados ambos lados de tu cedula o un pasaporte antes de solicitar un contrato", status: 403 };

      const previous = await tx.contract_requests.findFirst({ where: { propertyId: data.propertyId, tenantId: session.sub, status: "PENDIENTE" } });
      if (previous) return { error: "Ya tienes una solicitud pendiente para esta propiedad", status: 409 };

      const item = await tx.contract_requests.create({ data: { id: createTextId(), propertyId: data.propertyId, tenantId: session.sub, message: data.message || null, startDate: data.startDate ? new Date(data.startDate) : null, endDate: data.endDate ? new Date(data.endDate) : null, updatedAt: new Date() } });
      return { item };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ request: result.item }, { status: 201 });
  } catch (error) {
    if (isContractTransactionConflict(error)) {
      return NextResponse.json({ error: "La disponibilidad de la propiedad cambió durante la solicitud" }, { status: 409 });
    }
    console.error("contract request create error", error);
    return NextResponse.json({ error: "No se pudo crear la solicitud de forma segura" }, { status: 500 });
  }
}
