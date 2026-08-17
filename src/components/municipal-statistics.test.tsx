import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MunicipalStatistics, municipalInsights } from "@/components/municipal-statistics";

const data = { propertiesByZone: [{ zone: "Barbasquillo", count: 4 }], averageRentByZone: [{ zone: "Barbasquillo", averageRent: 600 }], incidentsByStatus: { PENDIENTE: 1, EN_PROCESO: 0, RESUELTO: 2 }, topLandlords: [{ id: "landlord-1", fullName: "Ana", active: true, propertiesCount: 4 }] };

describe("MunicipalStatistics", () => {
  afterEach(() => cleanup());
  it("renders KPI analytics, chart containers, ranking and deterministic insights", () => {
    render(<MunicipalStatistics data={data} loading={false} error={null} />);
    expect(screen.getByText("Propiedades por zona")).toBeInTheDocument();
    expect(screen.getByLabelText("Gráfico de propiedades por zona")).toBeInTheDocument();
    expect(screen.getByLabelText("Gráfico de renta promedio por zona")).toBeInTheDocument();
    expect(screen.getByLabelText("Gráfico de incidencias por estado")).toBeInTheDocument();
    expect(screen.getByText("Top arrendadores")).toBeInTheDocument();
    expect(screen.getByText(/Barbasquillo concentra la mayor cantidad/)).toBeInTheDocument();
  });

  it("keeps the no-incidents state compact and insight generation deterministic", () => {
    render(<MunicipalStatistics data={{ ...data, incidentsByStatus: { PENDIENTE: 0, EN_PROCESO: 0, RESUELTO: 0 } }} loading={false} error={null} />);
    expect(screen.getByText("No hay incidencias registradas.")).toBeInTheDocument();
    expect(screen.getByLabelText("Conteo de incidencias por estado")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("En proceso")).toBeInTheDocument();
    expect(screen.getByText("Resuelto")).toBeInTheDocument();
    expect(municipalInsights({ ...data, incidentsByStatus: { PENDIENTE: 0, EN_PROCESO: 0, RESUELTO: 0 } })[1]).toBe("No existen incidencias pendientes actualmente.");
  });

  it("soporta catálogo vacío sin romper KPIs ni ranking", () => {
    render(
      <MunicipalStatistics
        data={{ propertiesByZone: [], averageRentByZone: [], incidentsByStatus: { PENDIENTE: 0, EN_PROCESO: 0, RESUELTO: 0 }, topLandlords: [] }}
        loading={false}
        error={null}
      />,
    );
    expect(screen.getByText("Sin propiedades clasificadas")).toBeInTheDocument();
    expect(screen.getByText("Sin rentas para promediar")).toBeInTheDocument();
    expect(screen.getByText("No hay arrendadores registrados")).toBeInTheDocument();
  });
});
