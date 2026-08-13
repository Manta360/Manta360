/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { MapProperty } from "@/components/Map";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CircleMarker: ({ children }: { children?: ReactNode }) => <div data-testid="map-pin">{children}</div>,
  useMap: () => ({ flyTo: vi.fn(), openPopup: vi.fn() }),
}));

vi.mock("leaflet", () => ({
  divIcon: vi.fn(() => ({})),
}));

vi.mock("leaflet/dist/leaflet.css", () => ({}));

import Map from "@/components/Map";

function buildProperties(count: number): MapProperty[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `prop-${index}`,
    title: `Propiedad ${index}`,
    sector: "Tarqui",
    price: 400 + index,
    latitude: -0.9676 + index * 0.0001,
    longitude: -80.7127 + index * 0.0001,
  }));
}

describe("KAN-28 — rendimiento renderizado del mapa", () => {
  it("renderiza 100 pines en menos de 2 segundos sin colgarse", () => {
    const properties = buildProperties(100);
    const started = performance.now();

    render(<Map properties={properties} />);

    const pins = screen.getAllByTestId("map-pin");
    const elapsed = performance.now() - started;

    expect(pins).toHaveLength(100);
    expect(elapsed).toBeLessThan(2000);
  });
});
