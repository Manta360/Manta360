import { describe, expect, it, vi } from "vitest";
import { finalizeContractAndSynchronizeProperty, synchronizePropertyContractState } from "@/lib/property-contract-state";

function client(status: "DISPONIBLE" | "OCUPADO" | "MANTENIMIENTO" | "INHABILITADO", effective: boolean) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("SELECT id,status")) return { rows: [{ id: "property-1", status }], rowCount: 1 };
    if (sql.includes("SELECT 1 FROM public.contracts")) return { rows: effective ? [{ "?column?": 1 }] : [], rowCount: effective ? 1 : 0 };
    if (sql.includes("UPDATE public.properties")) return { rows: [], rowCount: 1 };
    if (sql.includes("UPDATE public.contracts SET status = 'FINALIZADO'")) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  return { query };
}

describe("KAN-47 - sincronizacion contrato/propiedad", () => {
  it("ocupa una propiedad cuando existe un contrato efectivo", async () => {
    const tx = client("DISPONIBLE", true);
    await synchronizePropertyContractState(tx as never, "property-1", new Date("2026-08-17T00:00:00Z"));
    expect(tx.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE public.properties"), expect.arrayContaining(["property-1", "OCUPADO"]));
  });

  it("libera una propiedad solo cuando no queda un contrato efectivo", async () => {
    const tx = client("OCUPADO", false);
    await synchronizePropertyContractState(tx as never, "property-1");
    expect(tx.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE public.properties"), expect.arrayContaining(["property-1", "DISPONIBLE"]));
  });

  it.each(["MANTENIMIENTO", "INHABILITADO"] as const)("preserva el estado administrativo %s", async (status) => {
    const tx = client(status, false);
    const result = await synchronizePropertyContractState(tx as never, "property-1");
    expect(result.changed).toBe(false);
    expect(tx.query).toHaveBeenCalledTimes(1);
  });

  it("no escribe cuando la propiedad ya es coherente", async () => {
    const tx = client("OCUPADO", true);
    const result = await synchronizePropertyContractState(tx as never, "property-1");
    expect(result.changed).toBe(false);
    expect(tx.query).toHaveBeenCalledTimes(2);
  });

  it("KAN-60 finaliza contrato y deja la propiedad DISPONIBLE", async () => {
    const tx = client("OCUPADO", false);
    const result = await finalizeContractAndSynchronizeProperty(tx as never, {
      contractId: "contract-1",
      propertyId: "property-1",
      endedBy: "tenant-1",
      now: new Date("2026-08-17T13:00:00Z"),
    });
    expect(result).toEqual({ finalized: true });
    expect(tx.query).toHaveBeenCalledWith(expect.stringContaining("FINALIZADO"), expect.arrayContaining(["contract-1", expect.any(Date), "tenant-1"]));
    expect(tx.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE public.properties"), expect.arrayContaining(["property-1", "DISPONIBLE"]));
  });
});
