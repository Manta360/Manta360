import Link from "next/link";
import type { Role } from "@/lib/roles";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/roles";
import { LogoutButton } from "@/components/logout-button";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { Badge } from "@/components/ui/badge";

type TopbarProps = { role: Role; fullName: string; email: string };

export function Topbar({ role, fullName, email }: TopbarProps) {
  return (
    <header className="flex min-h-[78px] flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3 shadow-[0_1px_0_rgb(16_42_67_/_3%)] sm:px-8">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky">Plataforma habitacional</p>
        <p className="mt-0.5 truncate text-lg font-black tracking-tight text-foreground">{fullName}</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <MobileNavigation role={role} />
        <nav className="hidden items-center gap-2 text-sm font-bold lg:flex" aria-label="Acciones de cuenta">
          <Link href={ROLE_HOME[role]} className="rounded-md px-3 py-2 text-primary transition hover:bg-sky/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25">Mi panel</Link>
          <Link href="/panel/documentos" className="rounded-md px-3 py-2 text-primary transition hover:bg-sky/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25">{role === "MUNICIPIO" ? "Documentos" : "Mis documentos"}</Link>
        </nav>
        <Badge tone="info" className="hidden sm:inline-flex">{ROLE_LABELS[role]}</Badge>
        <span className="hidden max-w-40 truncate text-xs font-semibold text-muted-foreground xl:inline">{email}</span>
        <div className="hidden lg:block"><LogoutButton /></div>
      </div>
    </header>
  );
}
