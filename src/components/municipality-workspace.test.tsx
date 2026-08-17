import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/identity-document-review-panel", () => ({ IdentityDocumentReviewPanel: () => <div>Revisión documental</div> }));
vi.mock("@/components/municipal-statistics", () => ({ MunicipalStatistics: () => <div>Estadísticas</div> }));

import { MunicipalityWorkspace } from "@/components/municipality-workspace";

const property = { id: "property-1", title: "Vista al mar", address: "Manta", monthlyRent: 650, approved: false, status: "DISPONIBLE", description: "Casa luminosa", bedrooms: 2, bathrooms: 1, users_properties_landlordIdTousers: { fullName: "Ana", email: "ana@test.com", phone: "0991234567" } };
const response = (body: unknown) => ({ ok: true, json: async () => body });

describe("MunicipalityWorkspace property preview", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ properties: [property], stats: { pendingProperties: 1, activeContracts: 0 } }))
      .mockResolvedValueOnce(response({ contracts: [] }))
      .mockResolvedValueOnce(response({ landlords: [] }))
      .mockResolvedValueOnce(response({ reports: [] }))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({ documents: [] }))
      .mockResolvedValueOnce(response({ property: { ...property, images: [{ id: "image-1", url: "https://signed.test/image", isPrimary: true, displayOrder: 0 }], services: ["Internet"], amenities: ["Piscina"] } })));
  });

  it("opens a complete administrative preview before the existing decision actions", async () => {
    render(<MunicipalityWorkspace module="properties" />);
    const button = await screen.findByRole("button", { name: "Ver propiedad" });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText("Internet")).toBeInTheDocument());
    expect(screen.getByText("Piscina")).toBeInTheDocument();
    expect(screen.getByAltText("Imagen de la propiedad")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Inhabilitar" })).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith("/api/admin/properties/property-1");
  });
});
