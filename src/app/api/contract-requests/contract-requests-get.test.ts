import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/contract-requests.server", () => ({ contractRequestsRepository: { listForSession: vi.fn() } }));

import { getActiveSession } from "@/lib/server-auth";
import { contractRequestsRepository } from "@/repositories/contract-requests.server";
import { GET } from "@/app/api/contract-requests/route";

const session = vi.mocked(getActiveSession);
const repository = vi.mocked(contractRequestsRepository);

const request = {
  id: "request-1",
  propertyId: "property-1",
  tenantId: "tenant-1",
  status: "PENDIENTE",
  message: null,
  startDate: null,
  endDate: null,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  updatedAt: new Date("2026-01-03T00:00:00.000Z"),
  properties: { id: "property-1", title: "Casa", address: "Manta", monthlyRent: "500.00", landlordId: "landlord-1" },
  users: { id: "tenant-1", fullName: "Tenant", email: "tenant@test", phone: null, nationalId: "0101" },
};

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ sub: "tenant-1", email: "tenant@test", fullName: "Tenant", role: "ARRENDATARIO" });
  repository.listForSession.mockResolvedValue([request]);
});

describe("GET /api/contract-requests", () => {
  it("returns 401 without a session", async () => {
    session.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sesión requerida" });
  });

  it.each(["ARRENDATARIO", "ARRENDADOR", "MUNICIPIO"] as const)("preserves %s visibility through the session", async (role) => {
    session.mockResolvedValue({ sub: "current-user", email: "user@test", fullName: "User", role });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(repository.listForSession).toHaveBeenCalledWith(role, "current-user");
  });

  it("preserves the response shape, numeric rent, dates, nulls, and safe user projection", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0]).toMatchObject({
      id: "request-1",
      status: "PENDIENTE",
      message: null,
      startDate: null,
      endDate: null,
      properties: { monthlyRent: 500, landlordId: "landlord-1" },
      users: request.users,
    });
    expect(body.requests[0].createdAt).toBe("2026-01-02T00:00:00.000Z");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });
});
