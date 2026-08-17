import { describe, expect, it, vi } from "vitest";
import { AdminStatsRepository } from "@/repositories/admin-stats.repository";

function executor(properties: unknown[], incidents: unknown[], landlords: unknown[]) {
  return {
    query: vi.fn()
      .mockResolvedValueOnce({ rows: properties })
      .mockResolvedValueOnce({ rows: incidents })
      .mockResolvedValueOnce({ rows: landlords }),
  };
}

describe("AdminStatsRepository", () => {
  it("preserva filtros, agregación por zona, ceros de incidencias, números reales y orden top-five", async () => {
    const query = executor(
      [
        { address: "TARQUI, Manta", monthlyRentCents: "10010" },
        { address: "Tarqui - sector residencial", monthlyRentCents: "29990" },
        { address: "CÉNTRO, Manta", monthlyRentCents: "25000" },
        { address: "Av. Flavio Reyes", monthlyRentCents: "50000" },
      ],
      [{ status: "PENDIENTE", count: "3" }, { status: "RESUELTO", count: "1" }],
      [
        { id: "l-1", fullName: "Ana", active: true, propertiesCount: "7" },
        { id: "l-2", fullName: "Bea", active: false, propertiesCount: "7" },
      ],
    ).query;

    const statistics = await new AdminStatsRepository({ query }).getStatistics();

    expect(statistics).toEqual({
      propertiesByZone: [
        { zone: "Tarqui", count: 2 },
        { zone: "Centro", count: 1 },
        { zone: "Zona no clasificada", count: 1 },
      ],
      averageRentByZone: [
        { zone: "Tarqui", averageRent: 200 },
        { zone: "Centro", averageRent: 250 },
        { zone: "Zona no clasificada", averageRent: 500 },
      ],
      incidentsByStatus: { PENDIENTE: 3, EN_PROCESO: 0, RESUELTO: 1 },
      topLandlords: [
        { id: "l-1", fullName: "Ana", active: true, propertiesCount: 7 },
        { id: "l-2", fullName: "Bea", active: false, propertiesCount: 7 },
      ],
    });
    expect(typeof statistics.averageRentByZone[0]?.averageRent).toBe("number");
    const sql = query.mock.calls.map(([text]) => text as string).join("\n");
    expect(sql).toContain('p.approved = true AND p.status <> \'INHABILITADO\'::"PropertyStatus"');
    expect(sql).toContain("GROUP BY status");
    expect(sql).toContain('ORDER BY COUNT(p.id) DESC, u."fullName" ASC, u.id ASC');
    expect(sql).toContain("LIMIT 5");
    expect(sql).not.toContain("passwordHash");
    expect(sql).not.toContain("users.*");
  });

  it("soporta 0 propiedades y hidrata incidencias en cero", async () => {
    const statistics = await new AdminStatsRepository({
      query: executor([], [], []).query,
    }).getStatistics();

    expect(statistics).toEqual({
      propertiesByZone: [],
      averageRentByZone: [],
      incidentsByStatus: { PENDIENTE: 0, EN_PROCESO: 0, RESUELTO: 0 },
      topLandlords: [],
    });
  });

  it("soporta una sola propiedad y calcula su promedio exacto", async () => {
    const statistics = await new AdminStatsRepository({
      query: executor(
        [{ address: "Barbasquillo norte", monthlyRentCents: "45000" }],
        [],
        [{ id: "l-1", fullName: "Solo", active: true, propertiesCount: "1" }],
      ).query,
    }).getStatistics();

    expect(statistics.propertiesByZone).toEqual([{ zone: "Barbasquillo", count: 1 }]);
    expect(statistics.averageRentByZone).toEqual([{ zone: "Barbasquillo", averageRent: 450 }]);
  });

  it("clasifica varias zonas con normalización y manda desconocidas a Zona no clasificada", async () => {
    const statistics = await new AdminStatsRepository({
      query: executor(
        [
          { address: "  LA   PRADERA ", monthlyRentCents: "10000" },
          { address: "alborada", monthlyRentCents: "20000" },
          { address: "barbasquillo", monthlyRentCents: "30000" },
          { address: "Calle sin sector", monthlyRentCents: "40000" },
        ],
        [],
        [],
      ).query,
    }).getStatistics();

    expect(statistics.propertiesByZone).toEqual([
      { zone: "Alborada", count: 1 },
      { zone: "Barbasquillo", count: 1 },
      { zone: "La Pradera", count: 1 },
      { zone: "Zona no clasificada", count: 1 },
    ]);
    expect(statistics.averageRentByZone).toEqual([
      { zone: "Alborada", averageRent: 200 },
      { zone: "Barbasquillo", averageRent: 300 },
      { zone: "La Pradera", averageRent: 100 },
      { zone: "Zona no clasificada", averageRent: 400 },
    ]);
  });

  it("calcula promedio correcto con varias rentas de la misma zona", async () => {
    const statistics = await new AdminStatsRepository({
      query: executor(
        [
          { address: "Centro 1", monthlyRentCents: "10000" },
          { address: "Centro 2", monthlyRentCents: "20000" },
          { address: "Centro 3", monthlyRentCents: "30000" },
        ],
        [],
        [],
      ).query,
    }).getStatistics();

    expect(statistics.propertiesByZone).toEqual([{ zone: "Centro", count: 3 }]);
    expect(statistics.averageRentByZone).toEqual([{ zone: "Centro", averageRent: 200 }]);
  });

  it("mantiene menos de 5 arrendadores y recorta a máximo 5", async () => {
    const underFive = await new AdminStatsRepository({
      query: executor(
        [],
        [],
        [
          { id: "l-1", fullName: "Ana", active: true, propertiesCount: "3" },
          { id: "l-2", fullName: "Bea", active: true, propertiesCount: "1" },
        ],
      ).query,
    }).getStatistics();
    expect(underFive.topLandlords).toHaveLength(2);

    const overFive = await new AdminStatsRepository({
      query: executor(
        [],
        [],
        [
          { id: "l-1", fullName: "A", active: true, propertiesCount: "9" },
          { id: "l-2", fullName: "B", active: true, propertiesCount: "8" },
          { id: "l-3", fullName: "C", active: true, propertiesCount: "7" },
          { id: "l-4", fullName: "D", active: true, propertiesCount: "6" },
          { id: "l-5", fullName: "E", active: true, propertiesCount: "5" },
          { id: "l-6", fullName: "F", active: true, propertiesCount: "4" },
        ],
      ).query,
    }).getStatistics();

    expect(overFive.topLandlords).toHaveLength(5);
    expect(overFive.topLandlords.map((landlord) => landlord.id)).toEqual(["l-1", "l-2", "l-3", "l-4", "l-5"]);
    expect(overFive.topLandlords[0]?.propertiesCount).toBe(9);
  });
});
