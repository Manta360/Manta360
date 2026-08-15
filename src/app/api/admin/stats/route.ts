import { IncidentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getMunicipalZone } from "@/lib/municipal-zone";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

type ZoneAccumulator = {
  count: number;
  totalRent: Prisma.Decimal;
};

const validPropertiesWhere = {
  approved: true,
  status: { not: "INHABILITADO" as const },
};

export async function GET() {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  const [properties, incidents, landlords] = await Promise.all([
    prisma.properties.findMany({
      where: validPropertiesWhere,
      select: { address: true, monthlyRent: true },
    }),
    prisma.incident_reports.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { role: "ARRENDADOR" },
      select: {
        id: true,
        fullName: true,
        active: true,
        _count: { select: { properties_properties_landlordIdTousers: true } },
      },
      orderBy: [
        { properties_properties_landlordIdTousers: { _count: "desc" } },
        { fullName: "asc" },
        { id: "asc" },
      ],
      take: 5,
    }),
  ]);

  const zones = new Map<string, ZoneAccumulator>();
  for (const property of properties) {
    const zone = getMunicipalZone(property.address);
    const current = zones.get(zone);
    zones.set(zone, current
      ? { count: current.count + 1, totalRent: current.totalRent.add(property.monthlyRent) }
      : { count: 1, totalRent: property.monthlyRent });
  }

  const sortedZones = [...zones.entries()]
    .map(([zone, value]) => ({ zone, ...value }))
    .sort((left, right) => right.count - left.count || left.zone.localeCompare(right.zone, "es-EC"));

  const incidentsByStatus: Record<IncidentStatus, number> = {
    PENDIENTE: 0,
    EN_PROCESO: 0,
    RESUELTO: 0,
  };
  for (const incident of incidents) {
    incidentsByStatus[incident.status] = incident._count._all;
  }

  return NextResponse.json({
    propertiesByZone: sortedZones.map(({ zone, count }) => ({ zone, count })),
    averageRentByZone: sortedZones.map(({ zone, count, totalRent }) => ({
      zone,
      averageRent: totalRent.dividedBy(count).toNumber(),
    })),
    incidentsByStatus,
    topLandlords: landlords.map((landlord) => ({
      id: landlord.id,
      fullName: landlord.fullName,
      active: landlord.active,
      propertiesCount: landlord._count.properties_properties_landlordIdTousers,
    })),
  });
}
