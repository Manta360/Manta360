import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({
  getActiveSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    properties: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    contracts: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getActiveSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { PATCH as disableProperty } from "@/app/api/admin/properties/[id]/disable/route";
import { GET as listLandlords } from "@/app/api/admin/users/route";

const mockedSession = vi.mocked(getActiveSession);
const mockedPrisma = vi.mocked(prisma);

describe("KAN-28 — permisos cruzados admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ARRENDADOR recibe 403 al inhabilitar propiedad", async () => {
    mockedSession.mockResolvedValue({
      sub: "landlord-1",
      email: "arrendador@test.com",
      role: "ARRENDADOR",
      fullName: "Arrendador Prueba",
    });

    const request = new Request("http://localhost/api/admin/properties/p1/disable", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Motivo legal de prueba suficientemente largo" }),
    });

    const response = await disableProperty(request, { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Acceso exclusivo del Municipio",
    });
  });

  it("ARRENDADOR recibe 403 al listar arrendadores", async () => {
    mockedSession.mockResolvedValue({
      sub: "landlord-1",
      email: "arrendador@test.com",
      role: "ARRENDADOR",
      fullName: "Arrendador Prueba",
    });

    const response = await listLandlords();
    expect(response.status).toBe(403);
  });

  it("MUNICIPIO recibe 400 si falta el motivo al inhabilitar", async () => {
    mockedSession.mockResolvedValue({
      sub: "muni-1",
      email: "municipio@test.com",
      role: "MUNICIPIO",
      fullName: "Funcionario",
    });

    const request = new Request("http://localhost/api/admin/properties/p1/disable", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "corto" }),
    });

    const response = await disableProperty(request, { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(400);
  });

  it("MUNICIPIO inhabilita propiedad con motivo válido (200)", async () => {
    mockedSession.mockResolvedValue({
      sub: "muni-1",
      email: "municipio@test.com",
      role: "MUNICIPIO",
      fullName: "Funcionario",
    });
    mockedPrisma.properties.findUnique.mockResolvedValue({ id: "p1", status: "DISPONIBLE" } as never);
    mockedPrisma.properties.update.mockResolvedValue({
      id: "p1",
      status: "INHABILITADO",
      monthlyRent: 750,
      disableReason: "Incumplimiento de regulaciones municipales",
    } as never);

    const request = new Request("http://localhost/api/admin/properties/p1/disable", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Incumplimiento de regulaciones municipales" }),
    });

    const response = await disableProperty(request, { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.property.status).toBe("INHABILITADO");
  });
});
