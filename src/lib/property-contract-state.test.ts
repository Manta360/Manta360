import { describe, expect, it, vi } from "vitest";
import { synchronizePropertyContractState } from "@/lib/property-contract-state";

function transaction(status: "DISPONIBLE" | "OCUPADO" | "MANTENIMIENTO" | "INHABILITADO", effective: boolean) {
  return {
    properties: {
      findUnique: vi.fn().mockResolvedValue({ id: "property-1", status }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    contracts: {
      findFirst: vi.fn().mockResolvedValue(effective ? { id: "contract-1" } : null),
    },
  };
}

describe("KAN-47 - sincronizacion contrato/propiedad", () => {
  it("ocupa una propiedad cuando existe un contrato efectivo", async () => {
    const tx = transaction("DISPONIBLE", true);
    await synchronizePropertyContractState(tx as never, "property-1", new Date("2026-08-17T00:00:00Z"));
    expect(tx.properties.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "OCUPADO" }),
    }));
  });

  it("libera una propiedad solo cuando no queda un contrato efectivo", async () => {
    const tx = transaction("OCUPADO", false);
    await synchronizePropertyContractState(tx as never, "property-1");
    expect(tx.properties.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "DISPONIBLE" }),
    }));
  });

  it.each(["MANTENIMIENTO", "INHABILITADO"] as const)("preserva el estado administrativo %s", async (status) => {
    const tx = transaction(status, false);
    const result = await synchronizePropertyContractState(tx as never, "property-1");
    expect(result.changed).toBe(false);
    expect(tx.contracts.findFirst).not.toHaveBeenCalled();
    expect(tx.properties.updateMany).not.toHaveBeenCalled();
  });

  it("no escribe cuando la propiedad ya es coherente", async () => {
    const tx = transaction("OCUPADO", true);
    const result = await synchronizePropertyContractState(tx as never, "property-1");
    expect(result.changed).toBe(false);
    expect(tx.properties.updateMany).not.toHaveBeenCalled();
  });
});
