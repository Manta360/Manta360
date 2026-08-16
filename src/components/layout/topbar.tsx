import Link from "next/link";
import type { Role } from "@/lib/roles";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/roles";
import { LogoutButton } from "@/components/logout-button";
import { MobileNavigation } from "@/components/layout/mobile-navigation";

type TopbarProps = { role: Role; fullName: string; email: string };

export function Topbar({ role, fullName, email }: TopbarProps) {
  const documentsHref = role === "MUNICIPIO" ? "/panel/municipio/documentos" : role === "ARRENDADOR" ? "/panel/arrendador/documentos" : "/panel/arrendatario/documentos";
  return <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3 sm:px-8">
    <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-sky">Manta360 · {ROLE_LABELS[role]}</p><p className="truncate font-black text-foreground">{fullName}</p></div>
    <div className="flex items-center gap-2 sm:gap-3"><MobileNavigation role={role} />
      <nav className="hidden items-center gap-2 text-sm font-bold lg:flex" aria-label="Acciones de cuenta"><Link href={ROLE_HOME[role]} className="rounded-md px-3 py-2 text-primary transition hover:bg-sky/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25">Mi panel</Link><Link href={documentsHref} className="rounded-md px-3 py-2 text-primary transition hover:bg-sky/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25">{role === "MUNICIPIO" ? "Documentos" : "Mis documentos"}</Link></nav>
      <span className="hidden max-w-40 truncate text-xs font-semibold text-muted-foreground xl:inline">{email}</span>
      <div className="hidden lg:block"><LogoutButton /></div>
    </div>
  </header>;
}
