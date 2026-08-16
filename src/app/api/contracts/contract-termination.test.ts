import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));

import { POST as reconcileExpirations } from "@/app/api/admin/contracts/reconcile-expirations/route";
import { POST as terminateContract } from "@/app/api/contracts/[id]/terminate/route";
import { reconcileExpiredContracts } from "@/lib/contract-lifecycle";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/server-auth";

const session = vi.mocked(getActiveSession);
const db = prisma as unknown as { $transaction: ReturnType<typeof vi.fn> };

const transaction = {
  contracts: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  properties: { updateMany: vi.fn() },
};

const activeContract = {
  id: "contract-1",
  propertyId: "property-1",
  tenantId: "tenant-1",
  landlordId: "landlord-1",
  status: "ACTIVO",
};

function terminateRequest() {
  return new Request("http://localhost/api/contracts/contract-1/terminate", { method: "POST" });
}

describe("KAN-46 - terminacion y expiracion contractual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.contracts.findMany.mockResolvedValue([]);
    transaction.contracts.findUnique.mockResolvedValue(activeContract);
    transaction.contracts.updateMany.mockResolvedValue({ count: 1 });
    transaction.properties.updateMany.mockResolvedValue({ count: 1 });
    db.$transaction.mockImplementation(async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction));
  });

  it.each([
    ["arrendatario", { sub: "tenant-1", email: "tenant@test.com", fullName: "Tenant", role: "ARRENDATARIO" as const }],
    ["arrendador", { sub: "landlord-1", email: "landlord@test.com", fullName: "Landlord", role: "ARRENDADOR" as const }],
  ])("permite que el %s finalice su contrato ACTIVO", async (_actor, actor) => {
    session.mockResolvedValue(actor);
    const response = await terminateContract(terminateRequest(), { params: Promise.resolve({ id: "contract-1" }) });
    expect(response.status).toBe(200);
    expect(transaction.contracts.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "contract-1", status: { in: ["ACTIVO", "EN_RENOVACION"] } }),
      data: expect.objectContaining({ status: "FINALIZADO", endedBy: actor.sub }),
    }));
    expect(transaction.properties.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "property-1", status: "OCUPADO" },
      data: expect.objectContaining({ status: "DISPONIBLE" }),
    }));
  });

  it("permite finalizar EN_RENOVACION porque sigue siendo un contrato efectivo", async () => {
    session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test.com", fullName: "Tenant", role: "ARRENDATARIO" });
    transaction.contracts.findUnique.mockResolvedValue({ ...activeContract, status: "EN_RENOVACION" });
    const response = await terminateContract(terminateRequest(), { params: Promise.resolve({ id: "contract-1" }) });
    expect(response.status).toBe(200);
    expect(transaction.contracts.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FINALIZADO" }),
    }));
  });

  it.each([
    ["otro arrendatario", { sub: "other-tenant", email: "other@test.com", fullName: "Other", role: "ARRENDATARIO" as const }],
    ["otro arrendador", { sub: "other-landlord", email: "other@test.com", fullName: "Other", role: "ARRENDADOR" as const }],
  ])("rechaza la terminacion solicitada por %s", async (_actor, actor) => {
    session.mockResolvedValue(actor);
    const response = await terminateContract(terminateRequest(), { params: Promise.resolve({ id: "contract-1" }) });
    expect(response.status).toBe(404);
    expect(transaction.contracts.updateMany).not.toHaveBeenCalled();
    expect(transaction.properties.updateMany).not.toHaveBeenCalled();
  });

  it("rechaza visitante, roles ajenos, contratos finalizados y pendientes", async () => {
    session.mockResolvedValue(null);
    await expect(terminateContract(terminateRequest(), { params: Promise.resolve({ id: "contract-1" }) })).resolves.toHaveProperty("status", 401);

    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test.com", fullName: "Municipio", role: "MUNICIPIO" });
    await expect(terminateContract(terminateRequest(), { params: Promise.resolve({ id: "contract-1" }) })).resolves.toHaveProperty("status", 403);

    session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test.com", fullName: "Tenant", role: "ARRENDATARIO" });
    transaction.contracts.findUnique.mockResolvedValue({ ...activeContract, status: "FINALIZADO" });
    await expect(terminateContract(terminateRequest(), { params: Promise.resolve({ id: "contract-1" }) })).resolves.toHaveProperty("status", 409);
    transaction.contracts.findUnique.mockResolvedValue({ ...activeContract, status: "PENDIENTE_FIRMA" });
    await expect(terminateContract(terminateRequest(), { params: Promise.resolve({ id: "contract-1" }) })).resolves.toHaveProperty("status", 409);
  });

  it("reconoce un contrato vencido, lo conserva y libera la propiedad en la misma transaccion", async () => {
    transaction.contracts.findMany.mockResolvedValue([{ id: "expired-1", propertyId: "property-1" }]);
    const finalized = await reconcileExpiredContracts(transaction as never, new Date("2026-08-16T00:00:00.000Z"));
    expect(finalized).toBe(1);
    expect(transaction.contracts.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FINALIZADO", endedBy: null }),
    }));
    expect(transaction.properties.updateMany).toHaveBeenCalledOnce();
  });

  it("no libera la propiedad si el cierre condicional no se concreta", async () => {
    session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test.com", fullName: "Tenant", role: "ARRENDATARIO" });
    transaction.contracts.updateMany.mockResolvedValue({ count: 0 });
    const response = await terminateContract(terminateRequest(), { params: Promise.resolve({ id: "contract-1" }) });
    expect(response.status).toBe(409);
    expect(transaction.properties.updateMany).not.toHaveBeenCalled();
  });

  it("permite la reconciliacion controlada solo al Municipio", async () => {
    session.mockResolvedValue({ sub: "municipio-1", email: "municipio@test.com", fullName: "Municipio", role: "MUNICIPIO" });
    const response = await reconcileExpirations();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ finalized: 0 });
  });
});
