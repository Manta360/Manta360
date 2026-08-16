import Link from "next/link";
import type { Role } from "@/lib/roles";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/roles";

type SidebarProps = { role: Role; activePath?: string };

export const roleNavigation = (role: Role) => [
  { href: ROLE_HOME[role], label: "Mi panel" },
  { href: "/panel/documentos", label: role === "MUNICIPIO" ? "Validar documentos" : "Mis documentos" },
];

export function Sidebar({ role, activePath }: SidebarProps) {
  return <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
    <Link href="/" className="flex items-center gap-3 px-6 py-6 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-navy text-lg font-black text-white">M</span>
      <span className="text-xl font-black tracking-tight text-navy">Manta<span className="text-sky">360</span></span>
    </Link>
    <div className="px-4"><p className="px-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{ROLE_LABELS[role]}</p>
      <nav className="mt-3 space-y-1" aria-label="Navegación principal">
        {roleNavigation(role).map((item) => {
          const active = activePath === item.href;
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`block rounded-md px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25 ${active ? "bg-sky/10 text-primary" : "text-muted hover:bg-surface-subtle hover:text-foreground"}`}>{item.label}</Link>;
        })}
      </nav>
    </div>
    <Link href="/" className="mt-auto px-6 py-6 text-sm font-bold text-muted transition hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25">Volver al inicio</Link>
  </aside>;
}
