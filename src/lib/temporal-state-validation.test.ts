import { describe, expect, it } from "vitest";
import {
  canTransitionIncidentStatus,
  hasValidContractDateRange,
  hasValidProvidedContractDateRange,
  isWithinRenewalWindow,
} from "@/lib/temporal-state-validation";

describe("KAN-44 - reglas temporales y de estado", () => {
  const start = new Date("2026-08-01T00:00:00.000Z");
  const end = new Date("2026-08-02T00:00:00.000Z");

  it("acepta únicamente periodos contractuales con fin posterior al inicio", () => {
    expect(hasValidContractDateRange(start, end)).toBe(true);
    expect(hasValidContractDateRange(start, start)).toBe(false);
    expect(hasValidContractDateRange(end, start)).toBe(false);
    expect(hasValidProvidedContractDateRange("not-a-date", end.toISOString())).toBe(false);
  });

  it("mantiene la ventana de renovación de los últimos quince días", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");
    expect(isWithinRenewalWindow(new Date("2026-08-16T12:00:00.000Z"), now)).toBe(true);
    expect(isWithinRenewalWindow(new Date("2026-08-16T12:00:00.001Z"), now)).toBe(false);
    expect(isWithinRenewalWindow(new Date("2026-08-01T11:59:59.999Z"), now)).toBe(false);
  });

  it("solo permite el flujo de incidencias pendiente, en proceso y resuelto", () => {
    expect(canTransitionIncidentStatus("PENDIENTE", "EN_PROCESO")).toBe(true);
    expect(canTransitionIncidentStatus("PENDIENTE", "RESUELTO")).toBe(true);
    expect(canTransitionIncidentStatus("EN_PROCESO", "RESUELTO")).toBe(true);
    expect(canTransitionIncidentStatus("EN_PROCESO", "PENDIENTE")).toBe(false);
    expect(canTransitionIncidentStatus("RESUELTO", "PENDIENTE")).toBe(false);
    expect(canTransitionIncidentStatus("RESUELTO", "EN_PROCESO")).toBe(false);
    expect(canTransitionIncidentStatus("PENDIENTE", "PENDIENTE")).toBe(false);
  });
});
