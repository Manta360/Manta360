import { describe, expect, it } from "vitest";
import { roleNavigation } from "@/components/layout/sidebar";

describe("role navigation", () => {
  it("separates the tenant workspace into focused modules", () => {
    expect(roleNavigation("ARRENDATARIO").map((item) => item.label)).toEqual([
      "Inicio", "Explorar", "Solicitudes", "Contratos", "Incidencias", "Documentos", "Mensajes",
    ]);
  });

  it("exposes the landlord and municipal workspaces as independent modules", () => {
    expect(roleNavigation("ARRENDADOR").map((item) => item.label)).toContain("Propiedades");
    expect(roleNavigation("MUNICIPIO").map((item) => item.label)).toEqual([
      "Resumen", "Pendientes", "Propiedades", "Contratos", "Documentos", "Arrendadores", "Incidencias", "Estadísticas",
    ]);
  });
});
