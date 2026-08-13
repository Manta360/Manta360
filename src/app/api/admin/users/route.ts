import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

export async function GET() {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  const landlords = await prisma.user.findMany({
    where: { role: "ARRENDADOR" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      nationalId: true,
      active: true,
      disabledAt: true,
      disabledBy: true,
      disableReason: true,
      createdAt: true,
      _count: { select: { properties_properties_landlordIdTousers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    landlords: landlords.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      email: item.email,
      phone: item.phone,
      nationalId: item.nationalId,
      active: item.active,
      disabledAt: item.disabledAt,
      disabledBy: item.disabledBy,
      disableReason: item.disableReason,
      createdAt: item.createdAt,
      propertiesCount: item._count.properties_properties_landlordIdTousers,
    })),
  });
}
