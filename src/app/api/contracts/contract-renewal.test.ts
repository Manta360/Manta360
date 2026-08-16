import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn(), contracts: { findMany: vi.fn() }, contract_renewal_requests: { findMany: vi.fn() } } }));
vi.mock("@/repositories/contract-renewals.server", () => ({ contractRenewalsRepository: { listForSession: vi.fn() } }));

import { POST as decideRenewal } from "@/app/api/contract-renewals/[id]/decision/route";
import { GET as listRenewals } from "@/app/api/contract-renewals/route";
import { POST as requestRenewal } from "@/app/api/contracts/[id]/renewal/route";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";
import { contractRenewalsRepository } from "@/repositories/contract-renewals.server";

const session = vi.mocked(getActiveSession);
const renewalRepository = vi.mocked(contractRenewalsRepository);
const db = prisma as unknown as { $transaction: ReturnType<typeof vi.fn>; contracts: { findMany: ReturnType<typeof vi.fn> }; contract_renewal_requests: { findMany: ReturnType<typeof vi.fn> } };
const contract = { id: "contract-1", propertyId: "property-1", tenantId: "tenant-1", landlordId: "landlord-1", status: "ACTIVO", startDate: new Date("2026-01-01T00:00:00Z"), endDate: new Date("2026-08-20T00:00:00Z") };
const renewal = { id: "renewal-1", contractId: "contract-1", requestedBy: "tenant-1", proposedEndDate: new Date("2027-08-20T00:00:00Z"), status: "PENDIENTE" };
const tx = {
  contracts: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  contract_renewal_requests: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  properties: { findUnique: vi.fn(), updateMany: vi.fn() },
};
const context = { params: Promise.resolve({ id: "contract-1" }) };

describe("KAN-48 - renovaciones contractuales", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-08-10T00:00:00Z"));
    session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test.com", fullName: "Tenant", role: "ARRENDATARIO" });
    tx.contracts.findMany.mockResolvedValue([]); tx.contracts.findFirst.mockResolvedValue({ id: "contract-1" }); tx.contracts.findUnique.mockResolvedValue(contract); tx.contracts.updateMany.mockResolvedValue({ count: 1 });
    tx.contract_renewal_requests.findFirst.mockResolvedValue(null); tx.contract_renewal_requests.findUnique.mockResolvedValue(renewal); tx.contract_renewal_requests.create.mockImplementation(async ({ data }) => data); tx.contract_renewal_requests.update.mockImplementation(async ({ data }) => ({ ...renewal, ...data }));
    tx.properties.findUnique.mockResolvedValue({ id: "property-1", status: "OCUPADO" }); tx.properties.updateMany.mockResolvedValue({ count: 1 });
    db.$transaction.mockImplementation(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx));
  });

  it("acepta una solicitud propia dentro de la ventana y marca EN_RENOVACION", async () => {
    const response = await requestRenewal(new Request("http://localhost/api/contracts/contract-1/renewal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposedEndDate: "2027-08-20T00:00:00.000Z" }) }), context);
    expect(response.status).toBe(201);
    expect(tx.contracts.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "EN_RENOVACION" }) }));
    expect(tx.contract_renewal_requests.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ requestedBy: "tenant-1" }) }));
  });

  it("rechaza solicitudes fuera de ventana, ajenas, duplicadas o sin extension real", async () => {
    tx.contracts.findUnique.mockResolvedValue({ ...contract, endDate: new Date("2026-08-26T00:00:00Z") });
    await expect(requestRenewal(new Request("http://localhost", { method: "POST" }), context)).resolves.toHaveProperty("status", 409);
    tx.contracts.findUnique.mockResolvedValue({ ...contract, tenantId: "other" });
    await expect(requestRenewal(new Request("http://localhost", { method: "POST" }), context)).resolves.toHaveProperty("status", 404);
    tx.contracts.findUnique.mockResolvedValue(contract); tx.contract_renewal_requests.findFirst.mockResolvedValue({ id: "pending" });
    await expect(requestRenewal(new Request("http://localhost", { method: "POST" }), context)).resolves.toHaveProperty("status", 409);
    tx.contract_renewal_requests.findFirst.mockResolvedValue(null);
    const invalid = await requestRenewal(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposedEndDate: "2026-08-20T00:00:00.000Z" }) }), context);
    expect(invalid.status).toBe(400);
  });

  it("permite al arrendador aprobar, extiende endDate y conserva OCUPADO", async () => {
    session.mockResolvedValue({ sub: "landlord-1", email: "landlord@test.com", fullName: "Landlord", role: "ARRENDADOR" });
    const response = await decideRenewal(new Request("http://localhost/api/contract-renewals/renewal-1/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APROBAR" }) }), { params: Promise.resolve({ id: "renewal-1" }) });
    expect(response.status).toBe(200);
    expect(tx.contracts.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ endDate: renewal.proposedEndDate, status: "ACTIVO" }) }));
    expect(tx.contract_renewal_requests.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "APROBADO" }) }));
    expect(tx.properties.updateMany).not.toHaveBeenCalled();
  });

  it("permite rechazar sin cambiar endDate ni liberar la propiedad", async () => {
    session.mockResolvedValue({ sub: "landlord-1", email: "landlord@test.com", fullName: "Landlord", role: "ARRENDADOR" });
    tx.contracts.findUnique.mockResolvedValue({ ...contract, status: "EN_RENOVACION" });
    const response = await decideRenewal(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "RECHAZAR" }) }), { params: Promise.resolve({ id: "renewal-1" }) });
    expect(response.status).toBe(200);
    expect(tx.contract_renewal_requests.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "RECHAZADO" }) }));
    expect(tx.contracts.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVO" }) }));
    expect(tx.properties.updateMany).not.toHaveBeenCalled();
  });

  it("bloquea la decision de un arrendador ajeno y no deja cambios parciales", async () => {
    session.mockResolvedValue({ sub: "other-landlord", email: "other@test.com", fullName: "Other", role: "ARRENDADOR" });
    const response = await decideRenewal(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APROBAR" }) }), { params: Promise.resolve({ id: "renewal-1" }) });
    expect(response.status).toBe(404);
    expect(tx.contracts.updateMany).not.toHaveBeenCalled(); expect(tx.contract_renewal_requests.update).not.toHaveBeenCalled();
  });

  it("lista para cada parte solo el historial de renovaciones de sus contratos", async () => {
    renewalRepository.listForSession.mockResolvedValue([{ ...renewal, contract: { id: "contract-1", startDate: contract.startDate, endDate: contract.endDate, status: contract.status, properties: { id: "property-1", title: "Casa", address: "Manta" } } }] as never);
    const response = await listRenewals();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ renewals: [{ id: "renewal-1", contract: { id: "contract-1" } }] });
  });
});
