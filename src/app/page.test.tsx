import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => <header>Header</header> }));
vi.mock("@/components/rental-catalog", () => ({ RentalCatalog: () => <div>Catálogo</div> }));
vi.mock("@/components/role-explorer", () => ({ RoleExplorer: () => <div>Recorridos por rol</div> }));

import HomePage from "@/app/page";

describe("public Manta360 landing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps public CTAs and anchors functional without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    render(await HomePage());

    expect(screen.getByRole("link", { name: "Explorar propiedades" })).toHaveAttribute("href", "#catalogo");
    expect(screen.getByRole("link", { name: "Conocer Manta360" })).toHaveAttribute("href", "#como-funciona");
    expect(screen.getAllByText("Arrendatario").length).toBeGreaterThan(0);
    expect(screen.getByText("Cómo funciona Manta360")).toBeInTheDocument();
  });

  it("adapts the primary CTA to the signed-in role panel", async () => {
    mocks.getSession.mockResolvedValue({ role: "ARRENDADOR" });
    render(await HomePage());
    expect(screen.getByRole("link", { name: "Ir a mi panel" })).toHaveAttribute("href", "/panel/arrendador");
  });
});
