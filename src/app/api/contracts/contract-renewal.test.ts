import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ connect: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/postgres-app", () => ({ applicationPostgres: { connect: mocks.connect } }));
vi.mock("@/lib/server-auth", () => ({ getActiveSession: mocks.session }));

import { POST as requestRenewal } from "@/app/api/contracts/[id]/renewal/route";
import { POST as decideRenewal } from "@/app/api/contract-renewals/[id]/decision/route";

function pg(handler: (sql: string) => { rows?: unknown[]; rowCount?: number }) { return { query: vi.fn(async (sql: string) => ({ rows: [], rowCount: 0, ...handler(sql) })), release: vi.fn() }; }
const endDate = new Date("2026-08-15T00:00:00.000Z");

describe("KAN-48 - renovaciones contractuales PostgreSQL", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z")); });
  afterEach(() => vi.useRealTimers());

  it("crea una solicitud dentro de la ventana y marca EN_RENOVACION", async () => {
    mocks.session.mockResolvedValue({ sub: "tenant-1", role: "ARRENDATARIO", email: "t@test.com", fullName: "Tenant" });
    const client = pg((sql) => {
      if (sql.startsWith("SELECT id,\"propertyId\",\"tenantId\"")) return { rows: [{ id: "contract-1", propertyId: "property-1", tenantId: "tenant-1", startDate: new Date("2026-01-01"), endDate, status: "ACTIVO" }], rowCount: 1 };
      if (sql.startsWith("SELECT 1 FROM public.contract_renewal_requests")) return { rowCount: 0 };
      if (sql.startsWith("UPDATE public.contracts SET status='EN_RENOVACION'")) return { rowCount: 1 };
      if (sql.startsWith("INSERT INTO public.contract_renewal_requests")) return { rows: [{ id: "renewal-1", status: "PENDIENTE" }], rowCount: 1 };
      if (sql.startsWith("SELECT id,status FROM public.properties")) return { rows: [{ id: "property-1", status: "OCUPADO" }], rowCount: 1 };
      if (sql.startsWith("SELECT 1 FROM public.contracts")) return { rowCount: 1 };
      return {};
    }); mocks.connect.mockResolvedValue(client);
    const response = await requestRenewal(new Request("http://localhost", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "contract-1" }) });
    expect(response.status).toBe(201);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO public.contract_renewal_requests"), expect.any(Array));
  });

  it("bloquea solicitudes fuera de la ventana de quince dias", async () => {
    mocks.session.mockResolvedValue({ sub: "tenant-1", role: "ARRENDATARIO", email: "t@test.com", fullName: "Tenant" });
    const client = pg((sql) => sql.startsWith("SELECT id,\"propertyId\",\"tenantId\"") ? { rows: [{ id: "contract-1", propertyId: "property-1", tenantId: "tenant-1", startDate: new Date("2026-01-01"), endDate: new Date("2026-08-17"), status: "ACTIVO" }], rowCount: 1 } : {}); mocks.connect.mockResolvedValue(client);
    expect((await requestRenewal(new Request("http://localhost", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "contract-1" }) })).status).toBe(409);
  });

  it("permite al arrendador aprobar y extender el contrato", async () => {
    mocks.session.mockResolvedValue({ sub: "landlord-1", role: "ARRENDADOR", email: "l@test.com", fullName: "Landlord" });
    const client = pg((sql) => {
      if (sql.startsWith("SELECT id,\"contractId\"")) return { rows: [{ id: "renewal-1", contractId: "contract-1", requestedBy: "tenant-1", proposedEndDate: new Date("2027-08-15"), status: "PENDIENTE" }], rowCount: 1 };
      if (sql.startsWith("SELECT id,\"propertyId\",\"tenantId\"")) return { rows: [{ id: "contract-1", propertyId: "property-1", tenantId: "tenant-1", landlordId: "landlord-1", startDate: new Date("2026-01-01"), endDate, status: "EN_RENOVACION" }], rowCount: 1 };
      if (sql.startsWith("UPDATE public.contracts SET \"endDate\"")) return { rowCount: 1 };
      if (sql.startsWith("SELECT id,status FROM public.properties")) return { rows: [{ id: "property-1", status: "OCUPADO" }], rowCount: 1 };
      if (sql.startsWith("SELECT 1 FROM public.contracts")) return { rowCount: 1 };
      return { rowCount: 1 };
    }); mocks.connect.mockResolvedValue(client);
    const response = await decideRenewal(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APROBAR" }) }), { params: Promise.resolve({ id: "renewal-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ approved: true });
  });
});
