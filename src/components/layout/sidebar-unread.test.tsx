import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { badgeForNavigationItem, emptyNavigationBadgeCounts } from "@/components/layout/use-role-navigation-badges";

vi.mock("next/navigation", () => ({ usePathname: () => "/panel/arrendador" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { ChatUnreadProvider } from "@/components/layout/chat-unread-provider";
import { Sidebar } from "@/components/layout/sidebar";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("navigation pending badges", () => {
  it("solo cuenta estados pendientes en la lógica de badges", () => {
    const counts = {
      ...emptyNavigationBadgeCounts,
      unreadMessages: 3,
      pendingRequests: 2,
      pendingSignatureContracts: 1,
      openIncidents: 4,
      pendingRenewals: 5,
      municipal: { inbox: 9, properties: 2, contracts: 3, documents: 4, incidents: 1 },
    };

    expect(badgeForNavigationItem("ARRENDADOR", "Solicitudes", "/panel/arrendador/solicitudes", counts)).toBe(2);
    expect(badgeForNavigationItem("ARRENDADOR", "Contratos", "/panel/arrendador/contratos", counts)).toBe(1);
    expect(badgeForNavigationItem("ARRENDADOR", "Incidencias", "/panel/arrendador/incidencias", counts)).toBe(4);
    expect(badgeForNavigationItem("ARRENDADOR", "Renovaciones", "/panel/arrendador/renovaciones", counts)).toBe(5);
    expect(badgeForNavigationItem("ARRENDADOR", "Propiedades", "/panel/arrendador/propiedades", counts)).toBe(0);
    expect(badgeForNavigationItem("ARRENDATARIO", "Mensajes", "/panel/arrendatario/mensajes", counts)).toBe(3);
    expect(badgeForNavigationItem("MUNICIPIO", "Pendientes", "/panel/municipio/pendientes", counts)).toBe(9);
    expect(badgeForNavigationItem("MUNICIPIO", "Propiedades", "/panel/municipio/propiedades", counts)).toBe(2);
    expect(badgeForNavigationItem("MUNICIPIO", "Contratos", "/panel/municipio/contratos", counts)).toBe(3);
    expect(badgeForNavigationItem("MUNICIPIO", "Documentos", "/panel/municipio/documentos", counts)).toBe(4);
    expect(badgeForNavigationItem("MUNICIPIO", "Incidencias", "/panel/municipio/incidencias", counts)).toBe(1);
    expect(badgeForNavigationItem("MUNICIPIO", "Estadísticas", "/panel/municipio/estadisticas", counts)).toBe(0);
  });

  it("muestra solo el conteo real y lo limpia cuando la conversación se lee", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unreadCount: 2, requests: [], contracts: [], reports: [], renewals: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatUnreadProvider role="ARRENDATARIO"><Sidebar role="ARRENDATARIO" /></ChatUnreadProvider>);

    await screen.findByText("2");
    expect(screen.getByText("Mensajes").parentElement).toHaveTextContent("Mensajes2");

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ unreadCount: 0, requests: [], contracts: [], reports: [], renewals: [] }) });
    window.dispatchEvent(new Event("manta360:chat-read"));
    await waitFor(() => expect(screen.queryByText("2")).not.toBeInTheDocument());
  });

  it("muestra solicitudes pendientes en el menú del arrendador", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/chat")) return { ok: true, json: async () => ({ unreadCount: 0 }) };
      if (url.includes("/api/auth/me")) return { ok: true, json: async () => ({ user: { id: "landlord-1" } }) };
      if (url.includes("/api/contract-requests")) {
        return { ok: true, json: async () => ({ requests: [{ status: "PENDIENTE" }, { status: "ACEPTADA" }, { status: "PENDIENTE" }] }) };
      }
      if (url.includes("/api/contracts")) return { ok: true, json: async () => ({ contracts: [] }) };
      if (url.includes("/api/incident-reports")) return { ok: true, json: async () => ({ reports: [] }) };
      if (url.includes("/api/contract-renewals")) return { ok: true, json: async () => ({ renewals: [] }) };
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatUnreadProvider role="ARRENDADOR"><Sidebar role="ARRENDADOR" /></ChatUnreadProvider>);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Solicitudes/i })).toHaveTextContent("2");
    });
  });

  it("muestra contratos pendientes de firma en el menú del arrendatario", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/chat")) return { ok: true, json: async () => ({ unreadCount: 0 }) };
      if (url.includes("/api/auth/me")) return { ok: true, json: async () => ({ user: { id: "tenant-1" } }) };
      if (url.includes("/api/contract-requests")) return { ok: true, json: async () => ({ requests: [] }) };
      if (url.includes("/api/contracts")) {
        return {
          ok: true,
          json: async () => ({
            contracts: [
              { status: "PENDIENTE_FIRMA", tenantId: "tenant-1", landlordId: "landlord-1", tenantSignedAt: null, landlordSignedAt: null },
              { status: "PENDIENTE_FIRMA", tenantId: "tenant-1", landlordId: "landlord-1", tenantSignedAt: "2026-08-16T00:00:00.000Z", landlordSignedAt: null },
              { status: "ACTIVO", tenantId: "tenant-1", landlordId: "landlord-1", tenantSignedAt: "2026-08-16T00:00:00.000Z", landlordSignedAt: "2026-08-16T00:00:00.000Z" },
            ],
          }),
        };
      }
      if (url.includes("/api/incident-reports")) return { ok: true, json: async () => ({ reports: [{ status: "RESUELTO" }, { status: "PENDIENTE" }] }) };
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatUnreadProvider role="ARRENDATARIO"><Sidebar role="ARRENDATARIO" /></ChatUnreadProvider>);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Contratos/i })).toHaveTextContent("1");
      expect(screen.getByRole("link", { name: /Incidencias/i })).toHaveTextContent("1");
    });
  });

  it("muestra pendientes municipales en contratos y documentos", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/chat")) return { ok: true, json: async () => ({ unreadCount: 0 }) };
      if (url.includes("/api/admin/properties")) {
        return { ok: true, json: async () => ({ properties: [{ approved: false, status: "DISPONIBLE" }, { approved: true, status: "DISPONIBLE" }] }) };
      }
      if (url.includes("/api/contracts")) {
        return { ok: true, json: async () => ({ contracts: [{ status: "PENDIENTE_MUNICIPIO" }, { status: "ACTIVO" }] }) };
      }
      if (url.includes("/api/review/identity-documents")) {
        return { ok: true, json: async () => ({ documents: [{ id: "d1" }, { id: "d2" }] }) };
      }
      if (url.includes("/api/incident-reports")) {
        return { ok: true, json: async () => ({ reports: [{ status: "EN_PROCESO" }, { status: "RESUELTO" }] }) };
      }
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatUnreadProvider role="MUNICIPIO"><Sidebar role="MUNICIPIO" /></ChatUnreadProvider>);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Pendientes/i })).toHaveTextContent("4");
      expect(screen.getByRole("link", { name: /^Propiedades/i })).toHaveTextContent("1");
      expect(screen.getByRole("link", { name: /^Contratos/i })).toHaveTextContent("1");
      expect(screen.getByRole("link", { name: /^Documentos/i })).toHaveTextContent("2");
      expect(screen.getByRole("link", { name: /^Incidencias/i })).toHaveTextContent("1");
    });
  });
});
