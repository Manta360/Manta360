import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/postgres-app", () => ({ applicationPostgres: {} }));

import { reconcileExpiredContractsWithPostgres } from "@/repositories/contracts.server";

describe("contract lifecycle PostgreSQL transaction", () => {
  it("retries SQLSTATE 40001 up to the historical serializable behavior", async () => {
    const first = { query: vi.fn(async (sql: string) => {
      if (sql.startsWith("SELECT id")) throw { code: "40001" };
      return { rows: [] };
    }), release: vi.fn() };
    const second = { query: vi.fn(async () => ({ rows: [] })), release: vi.fn() };
    const pool = { connect: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second) };

    await expect(reconcileExpiredContractsWithPostgres(pool, new Date("2026-08-16T00:00:00.000Z"))).resolves.toBe(0);
    expect(pool.connect).toHaveBeenCalledTimes(2);
    expect(first.query).toHaveBeenCalledWith("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    expect(first.query).toHaveBeenCalledWith("ROLLBACK");
    expect(second.query).toHaveBeenCalledWith("COMMIT");
  });
});
