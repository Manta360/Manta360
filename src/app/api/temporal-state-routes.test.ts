import { describe, expect, it } from "vitest";
import { canTransitionIncidentStatus, hasValidContractDateRange, isWithinRenewalWindow } from "@/lib/temporal-state-validation";

describe("KAN-44 - validaciones temporales", () => {
  it("acepta solo rangos contractuales estrictamente crecientes", () => {
    expect(hasValidContractDateRange(new Date("2026-08-10"), new Date("2026-08-11"))).toBe(true);
    expect(hasValidContractDateRange(new Date("2026-08-10"), new Date("2026-08-10"))).toBe(false);
    expect(hasValidContractDateRange(new Date("2026-08-11"), new Date("2026-08-10"))).toBe(false);
  });

  it("mantiene la ventana exacta de renovación de quince días", () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    expect(isWithinRenewalWindow(new Date("2026-08-15T00:00:00.000Z"), now)).toBe(true);
    expect(isWithinRenewalWindow(new Date("2026-08-16T00:00:00.001Z"), now)).toBe(false);
  });

  it("preserva las transiciones de incidencia", () => {
    expect(canTransitionIncidentStatus("PENDIENTE", "EN_PROCESO")).toBe(true);
    expect(canTransitionIncidentStatus("PENDIENTE", "RESUELTO")).toBe(true);
    expect(canTransitionIncidentStatus("RESUELTO", "PENDIENTE")).toBe(false);
  });
});
