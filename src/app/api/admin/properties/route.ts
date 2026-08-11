import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

export async function GET() {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  const [properties, counts] = await Promise.all([
    prisma.properties.findMany({ include: { users_properties_landlordIdTousers: { select: { fullName: true, email: true, phone: true, nationalId: true } } }, orderBy: { createdAt: "desc" } }),
    Promise.all([prisma.user.count(), prisma.properties.count({ where: { approved: false } }), prisma.properties.count({ where: { status: "OCUPADO" } }), prisma.contracts.count({ where: { status: "ACTIVO" } })]),
  ]);
  return NextResponse.json({ properties: properties.map((property) => ({ ...property, monthlyRent: Number(property.monthlyRent) })), stats: { users: counts[0], pendingProperties: counts[1], occupiedProperties: counts[2], activeContracts: counts[3] } });
}
