"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Role } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/roles";

type SidebarProps = { role: Role; activePath?: string };
type NavigationItem = { href: string; label: string };

export const roleNavigation = (role: Role): NavigationItem[] => {
  if (role === "ARRENDATARIO") return [
    { href: "/panel/arrendatario", label: "Inicio" }, { href: "/panel/arrendatario/explorar", label: "Explorar" }, { href: "/panel/arrendatario/solicitudes", label: "Solicitudes" }, { href: "/panel/arrendatario/contratos", label: "Contratos" }, { href: "/panel/arrendatario/incidencias", label: "Incidencias" }, { href: "/panel/arrendatario/documentos", label: "Documentos" }, { href: "/panel/arrendatario/mensajes", label: "Mensajes" },
  ];
  if (role === "ARRENDADOR") return [
    { href: "/panel/arrendador", label: "Inicio" }, { href: "/panel/arrendador/propiedades", label: "Propiedades" }, { href: "/panel/arrendador/solicitudes", label: "Solicitudes" }, { href: "/panel/arrendador/contratos", label: "Contratos" }, { href: "/panel/arrendador/renovaciones", label: "Renovaciones" }, { href: "/panel/arrendador/incidencias", label: "Incidencias" }, { href: "/panel/arrendador/mensajes", label: "Mensajes" }, { href: "/panel/arrendador/documentos", label: "Documentos" },
  ];
  return [
    { href: "/panel/municipio", label: "Resumen" }, { href: "/panel/municipio/pendientes", label: "Pendientes" }, { href: "/panel/municipio/propiedades", label: "Propiedades" }, { href: "/panel/municipio/contratos", label: "Contratos" }, { href: "/panel/municipio/documentos", label: "Documentos" }, { href: "/panel/municipio/arrendadores", label: "Arrendadores" }, { href: "/panel/municipio/incidencias", label: "Incidencias" }, { href: "/panel/municipio/estadisticas", label: "Estadísticas" },
  ];
};

export function Sidebar({ role, activePath }: SidebarProps) {
  const pathname = usePathname();
  const currentPath = activePath ?? pathname;
  const [municipalCounts, setMunicipalCounts] = useState({ pending: 0, contracts: 0, documents: 0 });

  useEffect(() => {
    if (role !== "MUNICIPIO") return;
    let cancelled = false;
    void Promise.all([fetch("/api/admin/properties"), fetch("/api/contracts"), fetch("/api/review/identity-documents?status=PENDIENTE")])
      .then(async ([propertiesResponse, contractsResponse, documentsResponse]) => {
        const [propertiesData, contractsData, documentsData] = await Promise.all([propertiesResponse.json(), contractsResponse.json(), documentsResponse.json()]);
        if (cancelled || !propertiesResponse.ok || !contractsResponse.ok || !documentsResponse.ok) return;
        const properties = propertiesData.properties ?? [];
        const contracts = contractsData.contracts ?? [];
        const documents = documentsData.documents ?? [];
        const pendingProperties = properties.filter((property: { approved: boolean; status: string }) => !property.approved && property.status !== "INHABILITADO").length;
        const pendingContracts = contracts.filter((contract: { status: string }) => contract.status === "PENDIENTE_MUNICIPIO").length;
        setMunicipalCounts({ pending: pendingProperties + pendingContracts + documents.length, contracts: pendingContracts, documents: documents.length });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [role]);

  const badgeFor = (href: string) => {
    if (href.endsWith("/pendientes")) return municipalCounts.pending;
    if (href.endsWith("/documentos")) return municipalCounts.documents;
    if (href.endsWith("/contratos")) return municipalCounts.contracts;
    return 0;
  };
  return <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col"><Link href="/" className="flex items-center gap-3 px-6 py-6 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25"><span className="grid h-10 w-10 place-items-center rounded-md bg-navy text-lg font-black text-white">M</span><span className="text-xl font-black tracking-tight text-navy">Manta<span className="text-sky">360</span></span></Link><div className="min-h-0 flex-1 overflow-y-auto px-4"><p className="px-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{ROLE_LABELS[role]}</p><nav className="mt-3 space-y-1" aria-label="Navegación principal">{roleNavigation(role).map((item) => { const active = currentPath === item.href; const badge = role === "MUNICIPIO" ? badgeFor(item.href) : 0; return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25 ${active ? "bg-sky/10 text-primary" : "text-muted hover:bg-surface-subtle hover:text-foreground"}`}><span>{item.label}</span>{badge > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800">{badge}</span> : null}</Link>; })}</nav></div><Link href="/" className="px-6 py-6 text-sm font-bold text-muted transition hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25">Volver al inicio</Link></aside>;
}
