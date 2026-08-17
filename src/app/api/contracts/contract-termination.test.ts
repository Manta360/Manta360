import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ connect: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/postgres-app", () => ({ applicationPostgres: { connect: mocks.connect } }));
vi.mock("@/lib/server-auth", () => ({ getActiveSession: mocks.session }));

import { POST as terminate } from "@/app/api/contracts/[id]/terminate/route";

function client(status = "ACTIVO", owner = "tenant-1") {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT id,\"propertyId\",\"tenantId\"")) return { rows: [{ id: "contract-1", propertyId: "property-1", tenantId: "tenant-1", landlordId: "landlord-1", status }], rowCount: 1 };
    if (sql.startsWith("UPDATE public.contracts SET status = 'FINALIZADO'")) return { rows: [], rowCount: 1 };
    if (sql.startsWith("SELECT id,status FROM public.properties")) return { rows: [{ id: "property-1", status: "OCUPADO" }], rowCount: 1 };
    if (sql.startsWith("SELECT 1 FROM public.contracts")) return { rows: [], rowCount: 0 };
    if (sql.startsWith("UPDATE public.properties")) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  return { query, release: vi.fn(), owner };
}

describe("KAN-46 - terminacion y expiracion contractual PostgreSQL", () => {
  beforeEach(() => vi.clearAllMocks());
  it("finaliza un contrato ACTIVO del arrendatario y sincroniza la propiedad", async () => {
    mocks.session.mockResolvedValue({ sub: "tenant-1", role: "ARRENDATARIO", email: "t@test.com", fullName: "Tenant" });
    const pg = client(); mocks.connect.mockResolvedValue(pg);
    const response = await terminate(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ finalized: true });
    expect(pg.query).toHaveBeenCalledWith(expect.stringContaining("endedBy"), expect.arrayContaining(["contract-1", expect.any(Date), "tenant-1"]));
    expect(pg.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE public.properties"), expect.arrayContaining(["property-1", "DISPONIBLE", expect.any(Date)]));
  });

  it("rechaza una parte ajena sin escribir", async () => {
    mocks.session.mockResolvedValue({ sub: "tenant-2", role: "ARRENDATARIO", email: "x@test.com", fullName: "Other" });
    const pg = client(); mocks.connect.mockResolvedValue(pg);
    expect((await terminate(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) })).status).toBe(404);
    expect(pg.query).not.toHaveBeenCalledWith(expect.stringContaining("SET status = 'FINALIZADO'"), expect.anything());
  });

  it("preserva la semantica de estado no terminable", async () => {
    mocks.session.mockResolvedValue({ sub: "tenant-1", role: "ARRENDATARIO", email: "t@test.com", fullName: "Tenant" });
    const pg = client("FINALIZADO"); mocks.connect.mockResolvedValue(pg);
    expect((await terminate(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) })).status).toBe(409);
  });
});
