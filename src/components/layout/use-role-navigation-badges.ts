"use client";

import { useCallback, useEffect, useState } from "react";
import type { Role } from "@/lib/roles";
import { useChatUnread } from "@/components/layout/chat-unread-provider";
import { NAVIGATION_BADGES_EVENT } from "@/components/layout/navigation-badges";

export type NavigationBadgeCounts = {
  unreadMessages: number;
  pendingRequests: number;
  pendingSignatureContracts: number;
  openIncidents: number;
  pendingRenewals: number;
  municipal: {
    inbox: number;
    properties: number;
    contracts: number;
    documents: number;
    incidents: number;
  };
};

export const emptyNavigationBadgeCounts: NavigationBadgeCounts = {
  unreadMessages: 0,
  pendingRequests: 0,
  pendingSignatureContracts: 0,
  openIncidents: 0,
  pendingRenewals: 0,
  municipal: { inbox: 0, properties: 0, contracts: 0, documents: 0, incidents: 0 },
};

function isOpenIncident(status: string) {
  return status === "PENDIENTE" || status === "EN_PROCESO";
}

function needsCurrentUserSignature(
  role: Role,
  userId: string,
  contract: { status: string; tenantId: string; landlordId: string; tenantSignedAt?: string | Date | null; landlordSignedAt?: string | Date | null },
) {
  if (contract.status !== "PENDIENTE_FIRMA") return false;
  if (role === "ARRENDATARIO" && contract.tenantId === userId) return !contract.tenantSignedAt;
  if (role === "ARRENDADOR" && contract.landlordId === userId) return !contract.landlordSignedAt;
  return false;
}

export function badgeForNavigationItem(
  role: Role,
  label: string,
  href: string,
  counts: NavigationBadgeCounts,
): number {
  if (role === "MUNICIPIO") {
    if (href.endsWith("/pendientes")) return counts.municipal.inbox;
    if (href.endsWith("/propiedades")) return counts.municipal.properties;
    if (href.endsWith("/contratos")) return counts.municipal.contracts;
    if (href.endsWith("/documentos")) return counts.municipal.documents;
    if (href.endsWith("/incidencias")) return counts.municipal.incidents;
    return 0;
  }

  if (label === "Mensajes") return counts.unreadMessages;
  if (label === "Solicitudes") return counts.pendingRequests;
  if (label === "Contratos") return counts.pendingSignatureContracts;
  if (label === "Incidencias") return counts.openIncidents;
  if (label === "Renovaciones") return counts.pendingRenewals;
  return 0;
}

async function loadRoleBadgeCounts(role: Role, unreadMessages: number): Promise<NavigationBadgeCounts> {
  if (role === "MUNICIPIO") {
    const [propertiesResponse, contractsResponse, documentsResponse, incidentsResponse] = await Promise.all([
      fetch("/api/admin/properties"),
      fetch("/api/contracts"),
      fetch("/api/review/identity-documents?status=PENDIENTE"),
      fetch("/api/incident-reports"),
    ]);
    const [propertiesData, contractsData, documentsData, incidentsData] = await Promise.all([
      propertiesResponse.json(),
      contractsResponse.json(),
      documentsResponse.json(),
      incidentsResponse.json(),
    ]);
    if (!propertiesResponse.ok || !contractsResponse.ok || !documentsResponse.ok || !incidentsResponse.ok) {
      return { ...emptyNavigationBadgeCounts, unreadMessages };
    }

    const properties = (propertiesData.properties ?? []) as Array<{ approved: boolean; status: string }>;
    const contracts = (contractsData.contracts ?? []) as Array<{ status: string }>;
    const documents = (documentsData.documents ?? []) as unknown[];
    const reports = (incidentsData.reports ?? []) as Array<{ status: string }>;
    const pendingProperties = properties.filter((property) => !property.approved && property.status !== "INHABILITADO").length;
    const pendingContracts = contracts.filter((contract) => contract.status === "PENDIENTE_MUNICIPIO").length;
    const pendingDocuments = documents.length;
    const openIncidents = reports.filter((report) => isOpenIncident(report.status)).length;

    return {
      ...emptyNavigationBadgeCounts,
      unreadMessages,
      municipal: {
        inbox: pendingProperties + pendingContracts + pendingDocuments,
        properties: pendingProperties,
        contracts: pendingContracts,
        documents: pendingDocuments,
        incidents: openIncidents,
      },
    };
  }

  if (role !== "ARRENDADOR" && role !== "ARRENDATARIO") {
    return { ...emptyNavigationBadgeCounts, unreadMessages };
  }

  const responses = await Promise.all([
    fetch("/api/auth/me"),
    fetch("/api/contract-requests"),
    fetch("/api/contracts"),
    fetch("/api/incident-reports"),
    ...(role === "ARRENDADOR" ? [fetch("/api/contract-renewals")] : []),
  ]);
  const payloads = await Promise.all(responses.map((response) => response.json()));
  const [meResponse, requestsResponse, contractsResponse, incidentsResponse, renewalsResponse] = responses;
  const [meData, requestsData, contractsData, incidentsData, renewalsData] = payloads;
  const userId = meResponse.ok ? String(meData.user?.id ?? "") : "";

  return {
    ...emptyNavigationBadgeCounts,
    unreadMessages,
    pendingRequests: requestsResponse.ok
      ? ((requestsData.requests ?? []) as Array<{ status: string }>).filter((item) => item.status === "PENDIENTE").length
      : 0,
    pendingSignatureContracts: contractsResponse.ok && userId
      ? ((contractsData.contracts ?? []) as Array<{
          status: string;
          tenantId: string;
          landlordId: string;
          tenantSignedAt?: string | null;
          landlordSignedAt?: string | null;
        }>).filter((item) => needsCurrentUserSignature(role, userId, item)).length
      : 0,
    openIncidents: incidentsResponse.ok
      ? ((incidentsData.reports ?? []) as Array<{ status: string }>).filter((item) => isOpenIncident(item.status)).length
      : 0,
    pendingRenewals:
      role === "ARRENDADOR" && renewalsResponse?.ok
        ? ((renewalsData.renewals ?? []) as Array<{ status: string }>).filter((item) => item.status === "PENDIENTE").length
        : 0,
  };
}

export function useRoleNavigationBadges(role: Role) {
  const { unreadCount } = useChatUnread();
  const [counts, setCounts] = useState<NavigationBadgeCounts>(emptyNavigationBadgeCounts);

  const refresh = useCallback(async () => {
    const next = await loadRoleBadgeCounts(role, unreadCount);
    setCounts(next);
  }, [role, unreadCount]);

  useEffect(() => {
    let cancelled = false;
    void loadRoleBadgeCounts(role, unreadCount)
      .then((next) => {
        if (!cancelled) setCounts(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [role, unreadCount]);

  useEffect(() => {
    const onRefresh = () => {
      void refresh().catch(() => undefined);
    };
    window.addEventListener(NAVIGATION_BADGES_EVENT, onRefresh);
    return () => window.removeEventListener(NAVIGATION_BADGES_EVENT, onRefresh);
  }, [refresh]);

  return {
    counts: { ...counts, unreadMessages: unreadCount },
    badgeFor: (label: string, href: string) =>
      badgeForNavigationItem(role, label, href, { ...counts, unreadMessages: unreadCount }),
    refresh,
  };
}
