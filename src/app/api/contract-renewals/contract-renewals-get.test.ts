import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/contract-renewals.server", () => ({ contractRenewalsRepository: { listForSession: vi.fn() } }));

import { GET } from "@/app/api/contract-renewals/route";
import { getActiveSession } from "@/lib/server-auth";
import { contractRenewalsRepository } from "@/repositories/contract-renewals.server";

const session = vi.mocked(getActiveSession);
const repository = vi.mocked(contractRenewalsRepository);
const renewal = {
  id: "renewal-1", contractId: "contract-1", requestedBy: "tenant-1", proposedEndDate: new Date("2027-08-20T00:00:00.000Z"),
  status: "PENDIENTE", createdAt: new Date("2026-08-12T00:00:00.000Z"), updatedAt: new Date("2026-08-12T00:00:00.000Z"),
  contract: {
    id: "contract-1", startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date("2026-08-20T00:00:00.000Z"), status: "EN_RENOVACION",
    properties: { id: "property-1", title: "Casa Manta", address: "Manta" },
  },
};

describe("GET /api/contract-renewals", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(() => undefined); repository.listForSession.mockResolvedValue([renewal] as never); });

  it.each([
    ["sin sesion", null, 403],
    ["municipio", { sub: "municipio-1", email: "m@test", fullName: "Municipio", role: "MUNICIPIO" as const }, 403],
  ])("preserves the historical rejection for %s", async (_label, actor, expectedStatus) => {
    session.mockResolvedValue(actor);
    const response = await GET();
    expect(response.status).toBe(expectedStatus);
    await expect(response.json()).resolves.toEqual({ error: "Sesion no autorizada" });
    expect(repository.listForSession).not.toHaveBeenCalled();
  });

  it.each([
    ["ARRENDATARIO", { sub: "tenant-1", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" as const }],
    ["ARRENDADOR", { sub: "landlord-1", email: "landlord@test", fullName: "Landlord", role: "ARRENDADOR" as const }],
  ])("lists only the historical scope for %s", async (role, actor) => {
    session.mockResolvedValue(actor);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(repository.listForSession).toHaveBeenCalledWith(role, actor.sub);
    await expect(response.json()).resolves.toEqual({
      renewals: [{
        ...renewal,
        proposedEndDate: renewal.proposedEndDate.toISOString(), createdAt: renewal.createdAt.toISOString(), updatedAt: renewal.updatedAt.toISOString(),
        contract: { ...renewal.contract, startDate: renewal.contract.startDate.toISOString(), endDate: renewal.contract.endDate.toISOString() },
      }],
    });
  });

  it("returns the historical empty array for an authorized actor without renewals", async () => {
    session.mockResolvedValue({ sub: "tenant-empty", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" });
    repository.listForSession.mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ renewals: [] });
  });

  it("maps an unexpected PostgreSQL failure without exposing internals", async () => {
    session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" });
    repository.listForSession.mockRejectedValue(new Error("SELECT passwordHash FROM users at db.internal"));
    const response = await GET();
    expect(response.status).toBe(500);
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("SELECT");
    expect(body).not.toContain("db.internal");
    expect(body).not.toContain("passwordHash");
  });
});
