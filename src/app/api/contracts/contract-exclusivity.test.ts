import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));

import { POST as createRequest } from "@/app/api/contract-requests/route";
import { POST as decideRequest } from "@/app/api/contract-requests/[id]/decision/route";
import { POST as municipalDecision } from "@/app/api/admin/contracts/[id]/decision/route";
import { runContractTransaction } from "@/lib/contract-exclusivity";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

const session = vi.mocked(getActiveSession);
const db = prisma as unknown as { $transaction: ReturnType<typeof vi.fn> };

const transaction = {
  properties: { findUnique: vi.fn(), updateMany: vi.fn() },
  identity_documents: { findMany: vi.fn() },
  contract_requests: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  contracts: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
};

const availableProperty = {
  id: "property-1",
  landlordId: "landlord-1",
  approved: true,
  status: "DISPONIBLE",
  monthlyRent: 650,
  users_properties_landlordIdTousers: { active: true },
};

const pendingRequest = {
  id: "request-1",
  propertyId: "property-1",
  tenantId: "tenant-1",
  status: "PENDIENTE",
  startDate: null,
  endDate: null,
  properties: availableProperty,
};

const pendingMunicipalContract = {
  id: "contract-1",
  propertyId: "property-1",
  status: "PENDIENTE_MUNICIPIO",
};

function decisionRequest(decision: "APROBADO" | "RECHAZADO") {
  return new Request("http://localhost/api/contract-requests/request-1/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
}

function municipalRequest(decision: "APROBAR" | "RECHAZAR") {
  return new Request("http://localhost/api/admin/contracts/contract-1/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
}

describe("KAN-43 - exclusividad contractual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.properties.findUnique.mockResolvedValue(availableProperty);
    transaction.properties.updateMany.mockResolvedValue({ count: 1 });
    transaction.identity_documents.findMany.mockResolvedValue([{ documentType: "PASAPORTE", side: "UNICA" }]);
    transaction.contract_requests.findUnique.mockResolvedValue(pendingRequest);
    transaction.contract_requests.findFirst.mockResolvedValue(null);
    transaction.contract_requests.create.mockImplementation(async ({ data }) => ({ ...data }));
    transaction.contract_requests.update.mockImplementation(async ({ data }) => ({ ...pendingRequest, ...data }));
    transaction.contract_requests.updateMany.mockResolvedValue({ count: 1 });
    transaction.contracts.findUnique.mockResolvedValue(pendingMunicipalContract);
    transaction.contracts.findFirst.mockResolvedValue(null);
    transaction.contracts.create.mockImplementation(async ({ data }) => ({ ...data }));
    transaction.contracts.update.mockImplementation(async ({ data }) => ({ ...pendingMunicipalContract, ...data }));
    db.$transaction.mockImplementation(async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction));
  });

  it("permite iniciar el flujo para una propiedad disponible", async () => {
    session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test.com", fullName: "Tenant", role: "ARRENDATARIO" });

    const response = await createRequest(new Request("http://localhost/api/contract-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: "property-1" }),
    }));

    expect(response.status).toBe(201);
    expect(transaction.contract_requests.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ propertyId: "property-1", tenantId: "tenant-1" }),
    }));
  });

  it("rechaza una aceptación directa si ya existe un contrato vigente", async () => {
    session.mockResolvedValue({ sub: "landlord-1", email: "landlord@test.com", fullName: "Landlord", role: "ARRENDADOR" });
    transaction.contracts.findFirst.mockResolvedValue({ id: "active-contract" });

    const response = await decideRequest(decisionRequest("APROBADO"), { params: Promise.resolve({ id: "request-1" }) });

    expect(response.status).toBe(409);
    expect(transaction.contract_requests.update).not.toHaveBeenCalled();
    expect(transaction.contracts.create).not.toHaveBeenCalled();
  });

  it("rechaza la aceptación si la propiedad dejó de estar disponible", async () => {
    session.mockResolvedValue({ sub: "landlord-1", email: "landlord@test.com", fullName: "Landlord", role: "ARRENDADOR" });
    transaction.contract_requests.findUnique.mockResolvedValue({
      ...pendingRequest,
      properties: { ...availableProperty, status: "MANTENIMIENTO" },
    });

    const response = await decideRequest(decisionRequest("APROBADO"), { params: Promise.resolve({ id: "request-1" }) });

    expect(response.status).toBe(409);
    expect(transaction.contract_requests.update).not.toHaveBeenCalled();
    expect(transaction.contracts.create).not.toHaveBeenCalled();
  });

  it("activa un contrato y ocupa la propiedad en una sola transacción", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test.com", fullName: "Municipio", role: "MUNICIPIO" });

    const response = await municipalDecision(municipalRequest("APROBAR"), { params: Promise.resolve({ id: "contract-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ approved: true });
    expect(transaction.properties.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "property-1", status: "DISPONIBLE", approved: true },
      data: expect.objectContaining({ status: "OCUPADO" }),
    }));
    expect(transaction.contracts.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "ACTIVO" }),
    }));
    expect(transaction.contract_requests.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { propertyId: "property-1", status: "PENDIENTE" },
      data: expect.objectContaining({ status: "RECHAZADO" }),
    }));
  });

  it("impide que el Municipio active un segundo contrato para la misma propiedad", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test.com", fullName: "Municipio", role: "MUNICIPIO" });
    transaction.contracts.findFirst.mockResolvedValue({ id: "active-contract" });

    const response = await municipalDecision(municipalRequest("APROBAR"), { params: Promise.resolve({ id: "contract-1" }) });

    expect(response.status).toBe(409);
    expect(transaction.properties.updateMany).not.toHaveBeenCalled();
    expect(transaction.contracts.update).not.toHaveBeenCalled();
  });

  it("no deja cambios posteriores si la reserva condicional de la propiedad falla", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test.com", fullName: "Municipio", role: "MUNICIPIO" });
    transaction.properties.updateMany.mockResolvedValue({ count: 0 });

    const response = await municipalDecision(municipalRequest("APROBAR"), { params: Promise.resolve({ id: "contract-1" }) });

    expect(response.status).toBe(409);
    expect(transaction.contracts.update).not.toHaveBeenCalled();
    expect(transaction.contract_requests.updateMany).not.toHaveBeenCalled();
  });

  it("reintenta una transacción que pierde una carrera serializable", async () => {
    let attempts = 0;
    db.$transaction.mockImplementation(async (operation: (tx: typeof transaction) => Promise<unknown>) => {
      attempts += 1;
      if (attempts === 1) {
        throw new Prisma.PrismaClientKnownRequestError("serialization failure", {
          code: "P2034",
          clientVersion: "test",
        });
      }
      return operation(transaction);
    });

    await expect(runContractTransaction(async () => "completed")).resolves.toBe("completed");
    expect(attempts).toBe(2);
  });
});
