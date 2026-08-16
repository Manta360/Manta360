import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/lib/contract-exclusivity", () => ({ isContractTransactionConflict: vi.fn(), runContractTransaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    contracts: { findUnique: vi.fn(), update: vi.fn() },
    contract_renewal_requests: { findFirst: vi.fn(), create: vi.fn() },
    incident_reports: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { PATCH as patchContract } from "@/app/api/contracts/[id]/route";
import { POST as requestRenewal } from "@/app/api/contracts/[id]/renewal/route";
import { POST as createContractRequest } from "@/app/api/contract-requests/route";
import { PATCH as patchIncident } from "@/app/api/incident-reports/[id]/route";
import { POST as createIncident } from "@/app/api/incident-reports/route";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
import { runContractTransaction } from "@/lib/contract-exclusivity";

const mockedSession = vi.mocked(getActiveSession);
const mockedPrisma = prisma as unknown as {
  contracts: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  contract_renewal_requests: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  incident_reports: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};

const contract = {
  id: "contract-1",
  propertyId: "property-1",
  tenantId: "tenant-1",
  landlordId: "landlord-1",
  status: "PENDIENTE_FIRMA",
  startDate: new Date("2026-08-01T00:00:00.000Z"),
  endDate: new Date("2026-09-01T00:00:00.000Z"),
  properties: { id: "property-1" },
  users_contracts_tenantIdTousers: { id: "tenant-1", fullName: "Tenant", email: "tenant@example.com", phone: null, nationalId: null },
  users_contracts_landlordIdTousers: { id: "landlord-1", fullName: "Landlord", email: "landlord@example.com", phone: null, nationalId: null },
};

describe("KAN-44 - validaciones directas de API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPrisma.contracts.findUnique.mockResolvedValue(contract as never);
    mockedPrisma.contracts.update.mockImplementation(async ({ data }) => ({ ...contract, ...data }));
  });

  it("rechaza rangos contractuales iguales, invertidos y no parseables antes de escribir", async () => {
    mockedSession.mockResolvedValue({ sub: "landlord-1", role: "ARRENDADOR", email: "landlord@example.com", fullName: "Landlord" });
    const context = { params: Promise.resolve({ id: "contract-1" }) };

    for (const body of [
      { startDate: "2026-08-10T00:00:00.000Z", endDate: "2026-08-10T00:00:00.000Z" },
      { startDate: "2026-08-11T00:00:00.000Z", endDate: "2026-08-10T00:00:00.000Z" },
      { startDate: "not-a-date", endDate: "2026-08-10T00:00:00.000Z" },
    ]) {
      const response = await patchContract(new Request("http://localhost/api/contracts/contract-1", { method: "PATCH", body: JSON.stringify(body) }), context);
      expect(response.status).toBe(400);
    }
    expect(mockedPrisma.contracts.update).not.toHaveBeenCalled();
  });

  it("rechaza por API una solicitud contractual con fechas inválidas antes de abrir la transacción", async () => {
    mockedSession.mockResolvedValue({ sub: "tenant-1", role: "ARRENDATARIO", email: "tenant@example.com", fullName: "Tenant" });
    const response = await createContractRequest(new Request("http://localhost/api/contract-requests", {
      method: "POST",
      body: JSON.stringify({ propertyId: "property-1", startDate: "2026-08-10T00:00:00.000Z", endDate: "2026-08-10T00:00:00.000Z" }),
    }));
    expect(response.status).toBe(400);
    expect(runContractTransaction).not.toHaveBeenCalled();
  });

  it("permite un rango contractual válido desde la API", async () => {
    mockedSession.mockResolvedValue({ sub: "landlord-1", role: "ARRENDADOR", email: "landlord@example.com", fullName: "Landlord" });
    const response = await patchContract(new Request("http://localhost/api/contracts/contract-1", {
      method: "PATCH",
      body: JSON.stringify({ startDate: "2026-08-10T00:00:00.000Z", endDate: "2026-08-11T00:00:00.000Z" }),
    }), { params: Promise.resolve({ id: "contract-1" }) });
    expect(response.status).toBe(200);
    expect(mockedPrisma.contracts.update).toHaveBeenCalledOnce();
  });

  it("ignora una fecha de incidencia manipulada y registra la fecha del servidor", async () => {
    mockedSession.mockResolvedValue({ sub: "tenant-1", role: "ARRENDATARIO", email: "tenant@example.com", fullName: "Tenant" });
    mockedPrisma.contracts.findUnique.mockResolvedValue({ ...contract, status: "ACTIVO" } as never);
    mockedPrisma.incident_reports.create.mockImplementation(async ({ data }) => ({ id: "report-1", ...data }));
    const response = await createIncident(new Request("http://localhost/api/incident-reports", {
      method: "POST",
      body: JSON.stringify({ contractId: "contract-1", description: "Una descripción de incidencia válida", incidentDate: "2099-01-01T00:00:00.000Z" }),
    }));
    expect(response.status).toBe(201);
    expect(mockedPrisma.incident_reports.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ incidentDate: expect.any(Date) }),
    }));
    const savedDate = mockedPrisma.incident_reports.create.mock.calls[0][0].data.incidentDate as Date;
    expect(savedDate.toISOString()).not.toBe("2099-01-01T00:00:00.000Z");
  });

  it("solo permite las transiciones de incidencia previstas", async () => {
    mockedSession.mockResolvedValue({ sub: "landlord-1", role: "ARRENDADOR", email: "landlord@example.com", fullName: "Landlord" });
    mockedPrisma.incident_reports.findUnique.mockResolvedValue({ id: "report-1", landlordId: "landlord-1", status: "PENDIENTE" } as never);
    mockedPrisma.incident_reports.update.mockImplementation(async ({ data }) => ({ id: "report-1", ...data }));

    const allowed = await patchIncident(new Request("http://localhost/api/incident-reports/report-1", { method: "PATCH", body: JSON.stringify({ status: "EN_PROCESO" }) }), { params: Promise.resolve({ id: "report-1" }) });
    expect(allowed.status).toBe(200);

    mockedPrisma.incident_reports.findUnique.mockResolvedValue({ id: "report-1", landlordId: "landlord-1", status: "RESUELTO" } as never);
    const rejected = await patchIncident(new Request("http://localhost/api/incident-reports/report-1", { method: "PATCH", body: JSON.stringify({ status: "EN_PROCESO" }) }), { params: Promise.resolve({ id: "report-1" }) });
    expect(rejected.status).toBe(409);
    expect(mockedPrisma.incident_reports.update).toHaveBeenCalledTimes(1);
  });

  it("acepta las dos salidas oficiales desde PENDIENTE y bloquea reversiones", async () => {
    mockedSession.mockResolvedValue({ sub: "landlord-1", role: "ARRENDADOR", email: "landlord@example.com", fullName: "Landlord" });
    mockedPrisma.incident_reports.update.mockImplementation(async ({ data }) => ({ id: "report-1", ...data }));

    mockedPrisma.incident_reports.findUnique.mockResolvedValue({ id: "report-1", landlordId: "landlord-1", status: "PENDIENTE" } as never);
    const resolvedFromPending = await patchIncident(new Request("http://localhost/api/incident-reports/report-1", { method: "PATCH", body: JSON.stringify({ status: "RESUELTO" }) }), { params: Promise.resolve({ id: "report-1" }) });
    expect(resolvedFromPending.status).toBe(200);

    mockedPrisma.incident_reports.findUnique.mockResolvedValue({ id: "report-1", landlordId: "landlord-1", status: "EN_PROCESO" } as never);
    const resolvedFromInProgress = await patchIncident(new Request("http://localhost/api/incident-reports/report-1", { method: "PATCH", body: JSON.stringify({ status: "RESUELTO" }) }), { params: Promise.resolve({ id: "report-1" }) });
    const backToPending = await patchIncident(new Request("http://localhost/api/incident-reports/report-1", { method: "PATCH", body: JSON.stringify({ status: "PENDIENTE" }) }), { params: Promise.resolve({ id: "report-1" }) });
    expect(resolvedFromInProgress.status).toBe(200);
    expect(backToPending.status).toBe(409);

    mockedPrisma.incident_reports.findUnique.mockResolvedValue({ id: "report-1", landlordId: "landlord-1", status: "RESUELTO" } as never);
    const reopenPending = await patchIncident(new Request("http://localhost/api/incident-reports/report-1", { method: "PATCH", body: JSON.stringify({ status: "PENDIENTE" }) }), { params: Promise.resolve({ id: "report-1" }) });
    const reopenInProgress = await patchIncident(new Request("http://localhost/api/incident-reports/report-1", { method: "PATCH", body: JSON.stringify({ status: "EN_PROCESO" }) }), { params: Promise.resolve({ id: "report-1" }) });
    expect(reopenPending.status).toBe(409);
    expect(reopenInProgress.status).toBe(409);
  });

  it("mantiene la ventana de renovación de quince días en el endpoint", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    mockedSession.mockResolvedValue({ sub: "tenant-1", role: "ARRENDATARIO", email: "tenant@example.com", fullName: "Tenant" });
    mockedPrisma.contracts.findUnique.mockResolvedValue({ ...contract, status: "ACTIVO", endDate: new Date("2026-08-15T00:00:00.000Z") } as never);
    mockedPrisma.contract_renewal_requests.findFirst.mockResolvedValue(null);
    mockedPrisma.contract_renewal_requests.create.mockImplementation(async ({ data }) => data);
    const allowed = await requestRenewal(new Request("http://localhost/api/contracts/contract-1/renewal", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) });
    expect(allowed.status).toBe(201);

    mockedPrisma.contracts.findUnique.mockResolvedValue({ ...contract, status: "ACTIVO", endDate: new Date("2026-08-16T00:00:00.001Z") } as never);
    const rejected = await requestRenewal(new Request("http://localhost/api/contracts/contract-1/renewal", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) });
    expect(rejected.status).toBe(409);
    vi.useRealTimers();
  });
});
