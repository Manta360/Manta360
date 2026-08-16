import { describe, expect, it, vi } from "vitest";
import { AdminStatsRepository } from "@/repositories/admin-stats.repository";

describe("AdminStatsRepository", () => {
  it("preserves filters, zone aggregation, zero statuses, number values, and the top-five order", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [
        { address: "TARQUI, Manta", monthlyRentCents: "10010" },
        { address: "Tarqui - sector residencial", monthlyRentCents: "29990" },
        { address: "CÉNTRO, Manta", monthlyRentCents: "25000" },
        { address: "Av. Flavio Reyes", monthlyRentCents: "50000" },
      ] })
      .mockResolvedValueOnce({ rows: [{ status: "PENDIENTE", count: "3" }, { status: "RESUELTO", count: "1" }] })
      .mockResolvedValueOnce({ rows: [
        { id: "l-1", fullName: "Ana", active: true, propertiesCount: "7" },
        { id: "l-2", fullName: "Bea", active: false, propertiesCount: "7" },
      ] });

    const statistics = await new AdminStatsRepository({ query }).getStatistics();

    expect(statistics).toEqual({
      propertiesByZone: [{ zone: "Tarqui", count: 2 }, { zone: "Centro", count: 1 }, { zone: "Zona no clasificada", count: 1 }],
      averageRentByZone: [{ zone: "Tarqui", averageRent: 200 }, { zone: "Centro", averageRent: 250 }, { zone: "Zona no clasificada", averageRent: 500 }],
      incidentsByStatus: { PENDIENTE: 3, EN_PROCESO: 0, RESUELTO: 1 },
      topLandlords: [{ id: "l-1", fullName: "Ana", active: true, propertiesCount: 7 }, { id: "l-2", fullName: "Bea", active: false, propertiesCount: 7 }],
    });
    const sql = query.mock.calls.map(([text]) => text as string).join("\n");
    expect(sql).toContain('p.approved = true AND p.status <> \'INHABILITADO\'::"PropertyStatus"');
    expect(sql).toContain("GROUP BY status");
    expect(sql).toContain('ORDER BY COUNT(p.id) DESC, u."fullName" ASC, u.id ASC');
    expect(sql).toContain("LIMIT 5");
    expect(sql).not.toContain("passwordHash");
    expect(sql).not.toContain("users.*");
  });
});
