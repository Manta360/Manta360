import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ connect: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/postgres-app", () => ({ applicationPostgres: { connect: mocks.connect } }));
vi.mock("@/lib/server-auth", () => ({ getActiveSession: mocks.session }));

import { POST as municipalDecision } from "@/app/api/admin/contracts/[id]/decision/route";
import { runContractTransaction } from "@/lib/contract-exclusivity";

function pgClient(handler: (sql: string, values?: unknown[]) => { rows?: unknown[]; rowCount?: number } | Promise<{ rows?: unknown[]; rowCount?: number }>) {
  return { query: vi.fn(async (sql: string, values?: unknown[]) => ({ rows: [], rowCount: 0, ...await handler(sql, values) })), release: vi.fn() };
}

function request(decision: "APROBAR" | "RECHAZAR") {
  return new Request("http://localhost/api/admin/contracts/contract-1/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
}

describe("KAN-43 - exclusividad contractual PostgreSQL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ sub: "municipio-1", role: "MUNICIPIO", email: "m@test.com", fullName: "Municipio" });
  });

  it("activa un contrato y reserva la propiedad en una transacción", async () => {
    const client = pgClient((sql) => {
      if (sql.startsWith("SELECT id,\"propertyId\",status")) return { rows: [{ id: "contract-1", propertyId: "property-1", status: "PENDIENTE_MUNICIPIO" }], rowCount: 1 };
      if (sql.includes("JOIN public.users")) return { rowCount: 1 };
      if (sql.startsWith("SELECT 1 FROM public.contracts")) return { rowCount: 0 };
      if (sql.startsWith("UPDATE public.properties SET status = 'OCUPADO'")) return { rowCount: 1 };
      if (sql.startsWith("SELECT id,status FROM public.properties")) return { rows: [{ id: "property-1", status: "OCUPADO" }], rowCount: 1 };
      if (sql.startsWith("SELECT 1 FROM public.contracts WHERE \"propertyId\"")) return { rowCount: 1 };
      return { rowCount: 1 };
    });
    mocks.connect.mockResolvedValue(client);
    const response = await municipalDecision(request("APROBAR"), { params: Promise.resolve({ id: "contract-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ approved: true });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE public.contracts SET status='ACTIVO'"), expect.any(Array));
  });

  it("rechaza un segundo contrato efectivo", async () => {
    const client = pgClient((sql) => {
      if (sql.startsWith("SELECT id,\"propertyId\",status")) return { rows: [{ id: "contract-1", propertyId: "property-1", status: "PENDIENTE_MUNICIPIO" }], rowCount: 1 };
      if (sql.includes("JOIN public.users")) return { rowCount: 1 };
      if (sql.startsWith("SELECT 1 FROM public.contracts")) return { rowCount: 1 };
      return {};
    });
    mocks.connect.mockResolvedValue(client);
    expect((await municipalDecision(request("APROBAR"), { params: Promise.resolve({ id: "contract-1" }) })).status).toBe(409);
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining("UPDATE public.contracts SET status='ACTIVO'"), expect.anything());
  });

  it("reintenta SQLSTATE 40001 y hace rollback", async () => {
    let connects = 0;
    mocks.connect.mockImplementation(async () => {
      connects += 1;
      const client = pgClient((sql) => sql === "BEGIN ISOLATION LEVEL SERIALIZABLE" && connects === 1 ? Promise.reject({ code: "40001" }) : {});
      return client;
    });
    await expect(runContractTransaction(async () => "completed")).resolves.toBe("completed");
    expect(connects).toBe(2);
  });
});
