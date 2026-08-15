import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/server-auth", () => ({
  getActiveSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    properties: { findMany: vi.fn() },
    incident_reports: { groupBy: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import { GET } from "@/app/api/admin/stats/route";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

const mockedSession = vi.mocked(getActiveSession);
const mockedPrisma = prisma as unknown as {
  properties: { findMany: ReturnType<typeof vi.fn> };
  incident_reports: { groupBy: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
};

const municipioSession = {
  sub: "municipio-1",
  email: "municipio@test.com",
  role: "MUNICIPIO" as const,
  fullName: "Municipio de Manta",
};

function configureStatisticsData() {
  mockedPrisma.properties.findMany.mockResolvedValue([
    { address: "TARQUI, Manta", monthlyRent: new Prisma.Decimal("100.10") },
    { address: "Tarqui - sector residencial", monthlyRent: new Prisma.Decimal("299.90") },
    { address: "CÉNTRO, Manta", monthlyRent: new Prisma.Decimal("250") },
    { address: "Av. Flavio Reyes", monthlyRent: new Prisma.Decimal("500") },
  ]);
  mockedPrisma.incident_reports.groupBy.mockResolvedValue([
    { status: "PENDIENTE", _count: { _all: 3 } },
    { status: "RESUELTO", _count: { _all: 1 } },
  ]);
  mockedPrisma.user.findMany.mockResolvedValue([
    { id: "l-1", fullName: "Ana", active: true, _count: { properties_properties_landlordIdTousers: 7 } },
    { id: "l-2", fullName: "Bea", active: false, _count: { properties_properties_landlordIdTousers: 7 } },
    { id: "l-3", fullName: "Carlos", active: true, _count: { properties_properties_landlordIdTousers: 2 } },
  ]);
}

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { session: null, label: "sin sesión" },
    { session: { ...municipioSession, role: "ARRENDADOR" as const }, label: "ARRENDADOR" },
    { session: { ...municipioSession, role: "ARRENDATARIO" as const }, label: "ARRENDATARIO" },
  ])("rejects $label with 403 before querying data", async ({ session }) => {
    mockedSession.mockResolvedValue(session);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mockedPrisma.properties.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.incident_reports.groupBy).not.toHaveBeenCalled();
    expect(mockedPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("returns the municipal aggregates with normalized zones and zero-filled incidents", async () => {
    mockedSession.mockResolvedValue(municipioSession);
    configureStatisticsData();

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      propertiesByZone: [
        { zone: "Tarqui", count: 2 },
        { zone: "Centro", count: 1 },
        { zone: "Zona no clasificada", count: 1 },
      ],
      averageRentByZone: [
        { zone: "Tarqui", averageRent: 200 },
        { zone: "Centro", averageRent: 250 },
        { zone: "Zona no clasificada", averageRent: 500 },
      ],
      incidentsByStatus: { PENDIENTE: 3, EN_PROCESO: 0, RESUELTO: 1 },
      topLandlords: [
        { id: "l-1", fullName: "Ana", active: true, propertiesCount: 7 },
        { id: "l-2", fullName: "Bea", active: false, propertiesCount: 7 },
        { id: "l-3", fullName: "Carlos", active: true, propertiesCount: 2 },
      ],
    });
  });

  it("uses the same valid-property filter for both zone aggregates", async () => {
    mockedSession.mockResolvedValue(municipioSession);
    configureStatisticsData();

    await GET();

    expect(mockedPrisma.properties.findMany).toHaveBeenCalledWith({
      where: { approved: true, status: { not: "INHABILITADO" } },
      select: { address: true, monthlyRent: true },
    });
  });

  it("requests every incident status and a safe, deterministic top five", async () => {
    mockedSession.mockResolvedValue(municipioSession);
    configureStatisticsData();

    await GET();

    expect(mockedPrisma.incident_reports.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      _count: { _all: true },
    });
    expect(mockedPrisma.user.findMany).toHaveBeenCalledWith({
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
    });
  });
});
