import { NextResponse } from "next/server";
import { z } from "zod";
import { createTextId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
import { contractUserSelect, toContractUser } from "@/lib/contract-user";

const requestSchema = z.object({ propertyId: z.string().min(1), message: z.string().trim().max(2000).optional(), startDate: z.string().datetime().optional(), endDate: z.string().datetime().optional() });

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
  const [property, verifiedDocuments] = await Promise.all([
    prisma.properties.findUnique({ where: { id: data.propertyId }, select: { id: true, landlordId: true, status: true, approved: true } }),
    prisma.identity_documents.findMany({ where: { userId: session.sub, isCurrent: true, verificationStatus: "VERIFICADO" }, select: { documentType: true, side: true } }),
  ]);
  if (!property || !property.approved || property.status !== "DISPONIBLE") return NextResponse.json({ error: "La propiedad ya no está disponible" }, { status: 409 });
  const verifiedSides = new Set(verifiedDocuments.filter((document) => document.documentType === "CEDULA").map((document) => document.side));
  const identityReady = verifiedDocuments.some((document) => document.documentType === "PASAPORTE") || (verifiedSides.has("FRENTE") && verifiedSides.has("REVERSO"));
  if (!identityReady) return NextResponse.json({ error: "Debes tener verificados ambos lados de tu cedula o un pasaporte antes de solicitar un contrato" }, { status: 403 });
  const previous = await prisma.contract_requests.findFirst({ where: { propertyId: data.propertyId, tenantId: session.sub, status: "PENDIENTE" } });
  if (previous) return NextResponse.json({ error: "Ya tienes una solicitud pendiente para esta propiedad" }, { status: 409 });
  const item = await prisma.contract_requests.create({ data: { id: createTextId(), propertyId: data.propertyId, tenantId: session.sub, message: data.message || null, startDate: data.startDate ? new Date(data.startDate) : null, endDate: data.endDate ? new Date(data.endDate) : null, updatedAt: new Date() } });
  return NextResponse.json({ request: item }, { status: 201 });
}
