import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockMap() {
      return <div data-testid="map-stub">Mapa</div>;
    },
}));

import { RentalCatalog } from "@/components/rental-catalog";

const property = {
  id: "catalog-1",
  title: "Departamento San Antonio",
  address: "Barrio San Antonio, Manta",
  monthlyRent: 350,
  status: "DISPONIBLE",
  description: "Departamento amplio",
  bedrooms: 2,
  bathrooms: 1,
  latitude: -0.95,
  longitude: -80.7,
  landlord: { id: "landlord-1", fullName: "Ana" },
  services: ["Agua"],
  amenities: ["Parqueo"],
  images: [],
  image: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function mockJson(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

describe("RentalCatalog", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/me")) return mockJson({ user: null }, false, 401);
        if (url.includes("/api/identity-documents")) return mockJson({ documents: [] });
        if (url.includes("/api/properties")) return mockJson({ properties: [property] });
        return mockJson({ error: "not found" }, false, 404);
      }),
    );
  });

  it("oculta filtros avanzados para visitante y carga el catálogo público sin query", async () => {
    render(<RentalCatalog />);

    await waitFor(() => {
      expect(screen.getByText("Departamento San Antonio")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Filtros avanzados del catálogo")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Ej. Barbasquillo, Centro")).not.toBeInTheDocument();

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/properties")).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("location="))).toBe(false);
  });

  it("muestra filtros al arrendatario y envía location/precio/servicios al backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/me")) {
          return mockJson({ user: { id: "tenant-1", role: "ARRENDATARIO", fullName: "Pedro" } });
        }
        if (url.includes("/api/identity-documents")) return mockJson({ documents: [{ isCurrent: true }] });
        if (url.includes("/api/properties")) return mockJson({ properties: [property] });
        return mockJson({ error: "not found" }, false, 404);
      }),
    );

    render(<RentalCatalog />);

    await waitFor(() => {
      expect(screen.getByLabelText("Filtros avanzados del catálogo")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Ej. Barbasquillo, Centro"), { target: { value: "San Antonio" } });
    fireEvent.change(screen.getByPlaceholderText("Mínimo $"), { target: { value: "100" } });
    fireEvent.change(screen.getByPlaceholderText("Máximo $"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Agua" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      expect(
        fetchMock.mock.calls.some(([url]) => {
          const value = String(url);
          return (
            value.startsWith("/api/properties?") &&
            value.includes("location=San+Antonio") &&
            value.includes("minPrice=100") &&
            value.includes("maxPrice=500") &&
            value.includes("services=Agua")
          );
        }),
      ).toBe(true);
    });
  });

  it("no muestra filtros avanzados para arrendador autenticado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/me")) {
          return mockJson({ user: { id: "landlord-1", role: "ARRENDADOR", fullName: "Ana" } });
        }
        if (url.includes("/api/identity-documents")) return mockJson({ documents: [] });
        if (url.includes("/api/properties")) return mockJson({ properties: [property] });
        return mockJson({ error: "not found" }, false, 404);
      }),
    );

    render(<RentalCatalog />);

    await waitFor(() => {
      expect(screen.getByText("Departamento San Antonio")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Filtros avanzados del catálogo")).not.toBeInTheDocument();
  });
});
