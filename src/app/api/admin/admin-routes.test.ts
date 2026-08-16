import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({
  getActiveSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    properties: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    contracts: { count: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/repositories/admin-users.server", () => ({
  adminUsersRepository: { listLandlords: vi.fn() },
}));

import { getActiveSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { adminUsersRepository } from "@/repositories/admin-users.server";
import { PATCH as disableProperty } from "@/app/api/admin/properties/[id]/disable/route";
import { GET as listLandlords, POST as createLandlord } from "@/app/api/admin/users/route";
import {
  GET as getLandlord,
  PATCH as updateLandlord,
} from "@/app/api/admin/users/[id]/route";

const mockedSession = vi.mocked(getActiveSession);
type PrismaMocks = {
  properties: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  contracts: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockedPrisma = prisma as unknown as PrismaMocks;
const mockedAdminUsersRepository = vi.mocked(adminUsersRepository);

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

describe("KAN-39 — gestión administrativa de arrendadores", () => {
  const municipioSession = {
    sub: "muni-1",
    email: "municipio@test.com",
    role: "MUNICIPIO" as const,
    fullName: "Funcionario",
  };
  const landlord = {
    id: "landlord-1",
    fullName: "María Arrendadora",
    email: "maria@example.com",
    phone: "0987654321",
    nationalId: "1316551017",
    role: "ARRENDADOR",
    active: true,
    disabledAt: null,
    disabledBy: null,
    disableReason: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedSession.mockResolvedValue(municipioSession);
  });

  it("crea exclusivamente un Arrendador con contraseña hasheada", async () => {
    mockedPrisma.user.create.mockImplementation(async (args: { data: object }) => ({
      ...landlord,
      ...(args.data as object),
    }) as never);

    const response = await createLandlord(new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: landlord.fullName,
        email: landlord.email,
        phone: landlord.phone,
        nationalId: landlord.nationalId,
        password: "claveSegura1",
        role: "ARRENDATARIO",
      }),
    }));

    expect(response.status).toBe(201);
    expect(mockedPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: "ARRENDADOR", passwordHash: expect.not.stringMatching(/^claveSegura1$/) }),
    }));
    await expect(response.json()).resolves.toMatchObject({ landlord: { role: "ARRENDADOR" } });
  });

  it("fuerza ARRENDADOR aunque el Municipio envíe role: MUNICIPIO", async () => {
    mockedPrisma.user.create.mockImplementation(async (args: { data: object }) => ({
      ...landlord,
      ...(args.data as object),
    }) as never);

    const response = await createLandlord(new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: landlord.fullName,
        email: "municipio-intento@example.com",
        phone: landlord.phone,
        nationalId: "1316551018",
        password: "claveSegura1",
        role: "MUNICIPIO",
      }),
    }));

    expect(response.status).toBe(201);
    expect(mockedPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: "ARRENDADOR" }),
    }));
    await expect(response.json()).resolves.toMatchObject({ landlord: { role: "ARRENDADOR" } });
  });

  it("no permite consultar a un Arrendatario como detalle administrativo", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue(null);

    const response = await getLandlord(
      new Request("http://localhost/api/admin/users/tenant-1"),
      { params: Promise.resolve({ id: "tenant-1" }) },
    );

    expect(response.status).toBe(404);
    expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "tenant-1", role: "ARRENDADOR" },
    }));
  });

  it("devuelve detalle seguro del Arrendador sin passwordHash", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue(landlord as never);

    const response = await getLandlord(
      new Request("http://localhost/api/admin/users/landlord-1"),
      { params: Promise.resolve({ id: landlord.id }) },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.landlord).toMatchObject({ id: landlord.id, email: landlord.email, active: true });
    expect(data.landlord).not.toHaveProperty("passwordHash");
  });

  it("edita campos básicos sin cambiar el rol ni requerir nuevos datos únicos", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue(landlord as never);
    mockedPrisma.user.update.mockResolvedValue({ ...landlord, fullName: "María Actualizada" } as never);

    const response = await updateLandlord(
      new Request("http://localhost/api/admin/users/landlord-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "María Actualizada",
          email: landlord.email,
          phone: landlord.phone,
          nationalId: landlord.nationalId,
        }),
      }),
      { params: Promise.resolve({ id: landlord.id }) },
    );

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        fullName: "María Actualizada",
        email: landlord.email,
        phone: landlord.phone,
        nationalId: landlord.nationalId,
      },
    }));
  });

  it("rechaza cambios de rol o contraseña mediante PATCH", async () => {
    const response = await updateLandlord(
      new Request("http://localhost/api/admin/users/landlord-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "MUNICIPIO", password: "claveSegura1" }),
      }),
      { params: Promise.resolve({ id: landlord.id }) },
    );

    expect(response.status).toBe(400);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rechaza inhabilitar sin motivo sin modificar usuario ni propiedades", async () => {
    const response = await updateLandlord(
      new Request("http://localhost/api/admin/users/landlord-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: landlord.id }) },
    );

    expect(response.status).toBe(400);
    expect(mockedPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    expect(mockedPrisma.properties.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { name: "mezcla perfil e inhabilitación", payload: { fullName: "Nuevo nombre", active: false, reason: "Motivo válido de inhabilitación" } },
    { name: "mezcla perfil y rehabilitación", payload: { email: "nuevo@example.com", active: true } },
    { name: "incluye motivo al rehabilitar", payload: { active: true, reason: "Texto que no corresponde" } },
  ])("rechaza payload que $name", async ({ payload }) => {
    const response = await updateLandlord(
      new Request("http://localhost/api/admin/users/landlord-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ id: landlord.id }) },
    );

    expect(response.status).toBe(400);
    expect(mockedPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    expect(mockedPrisma.properties.updateMany).not.toHaveBeenCalled();
  });

  it("conserva la inhabilitación lógica y de propiedades asociadas", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue(landlord as never);
    mockedPrisma.user.update.mockResolvedValue({ ...landlord, active: false } as never);
    mockedPrisma.properties.updateMany.mockResolvedValue({ count: 2 } as never);
    mockedPrisma.$transaction.mockImplementation(async (operation: unknown) =>
      typeof operation === "function" ? operation(mockedPrisma) : Promise.all(operation as unknown[]) as never);

    const response = await updateLandlord(
      new Request("http://localhost/api/admin/users/landlord-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false, reason: "Incumplimiento de regulaciones municipales" }),
      }),
      { params: Promise.resolve({ id: landlord.id }) },
    );

    expect(response.status).toBe(200);
    expect(mockedPrisma.properties.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { landlordId: landlord.id },
      data: expect.objectContaining({ status: "INHABILITADO", approved: false }),
    }));
  });

  it("lista exclusivamente arrendadores", async () => {
    mockedAdminUsersRepository.listLandlords.mockResolvedValue([{ ...landlord, propertiesCount: 1 }]);

    const response = await listLandlords();

    expect(response.status).toBe(200);
    expect(mockedAdminUsersRepository.listLandlords).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({ landlords: [{ id: landlord.id, role: "ARRENDADOR" }] });
  });

  it("conserva la rehabilitación y devuelve las propiedades a revisión", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue({ ...landlord, active: false } as never);
    mockedPrisma.user.update.mockResolvedValue(landlord as never);
    mockedPrisma.properties.updateMany.mockResolvedValue({ count: 2 } as never);
    mockedPrisma.properties.findMany.mockResolvedValue([] as never);
    mockedPrisma.contracts.findFirst.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (operation: unknown) =>
      typeof operation === "function" ? operation(mockedPrisma) : Promise.all(operation as unknown[]) as never);

    const response = await updateLandlord(
      new Request("http://localhost/api/admin/users/landlord-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      }),
      { params: Promise.resolve({ id: landlord.id }) },
    );

    expect(response.status).toBe(200);
    expect(mockedPrisma.properties.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { landlordId: landlord.id, status: "INHABILITADO" },
      data: expect.objectContaining({ status: "DISPONIBLE", approved: false, disabledAt: null }),
    }));
  });

  it.each([
    { active: false, currentActive: false, error: "El arrendador ya está inhabilitado" },
    { active: true, currentActive: true, error: "El arrendador ya está activo" },
  ])("rechaza una transición de estado inexistente: $active", async ({ active, currentActive, error }) => {
    mockedPrisma.user.findFirst.mockResolvedValue({ ...landlord, active: currentActive } as never);

    const response = await updateLandlord(
      new Request("http://localhost/api/admin/users/landlord-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(active ? { active: true } : { active: false, reason: "Motivo válido de inhabilitación" }),
      }),
      { params: Promise.resolve({ id: landlord.id }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error });
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    expect(mockedPrisma.properties.updateMany).not.toHaveBeenCalled();
  });

  it.each(["ARRENDADOR", "ARRENDATARIO"] as const)("rechaza el acceso administrativo nuevo para %s", async (role) => {
    mockedSession.mockResolvedValue({
      sub: `${role.toLowerCase()}-1`,
      email: `${role.toLowerCase()}@test.com`,
      role,
      fullName: "Usuario sin permisos",
    });

    const createResponse = await createLandlord(new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }));
    const detailResponse = await getLandlord(
      new Request("http://localhost/api/admin/users/landlord-1"),
      { params: Promise.resolve({ id: landlord.id }) },
    );
    const updateResponse = await updateLandlord(
      new Request("http://localhost/api/admin/users/landlord-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Nombre válido" }),
      }),
      { params: Promise.resolve({ id: landlord.id }) },
    );

    expect(createResponse.status).toBe(403);
    expect(detailResponse.status).toBe(403);
    expect(updateResponse.status).toBe(403);
  });
});
