"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/roles";

type SidebarProps = { role: Role };

export const roleNavigation = (role: Role) => [
  { href: ROLE_HOME[role], label: "Mi panel", icon: "panel" as const },
  { href: "/panel/documentos", label: role === "MUNICIPIO" ? "Validar documentos" : "Mis documentos", icon: "documents" as const },
];

export function NavigationIcon({ name }: { name: "panel" | "documents" }) {
  return name === "panel" ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
      <path d="M7 3h7l4 4v14H7zM14 3v5h5M10 12h5M10 16h5" />
    </svg>
  );
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-navy bg-navy text-white lg:flex lg:flex-col">
      <Link href="/" className="flex items-center gap-3 border-b border-white/10 px-7 py-7 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky/50">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-white text-lg font-black text-navy shadow-sm">M</span>
        <span className="text-xl font-black tracking-tight text-white">Manta<span className="text-sky">360</span></span>
      </Link>
      <div className="px-5 pt-7">
        <p className="px-3 text-xs font-bold uppercase tracking-[0.16em] text-sky">Espacio de trabajo</p>
        <p className="mt-2 px-3 text-lg font-extrabold tracking-tight text-white">{ROLE_LABELS[role]}</p>
        <nav className="mt-5 space-y-1.5" aria-label="Navegación principal">
          {roleNavigation(role).map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/50 ${active ? "bg-white text-navy shadow-sm" : "text-white/78 hover:bg-white/10 hover:text-white"}`}>
                <NavigationIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mx-5 mt-auto mb-5 rounded-xl border border-white/12 bg-white/5 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky">Manta360</p>
        <p className="mt-1 text-sm leading-5 text-white/72">Gestión habitacional para una ciudad más ordenada.</p>
        <Link href="/" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white transition hover:text-sky focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/50">
          Ir al portal público <span aria-hidden="true">→</span>
        </Link>
      </div>
    </aside>
  );
}
