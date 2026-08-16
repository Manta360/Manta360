import Link from "next/link";
import { getSession } from "@/lib/session";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/roles";
import { LogoutButton } from "@/components/logout-button";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="border-b-2 border-sky/20 bg-white/95 shadow-[0_1px_0_rgb(16_42_67_/_3%)] backdrop-blur">
      <div className="mx-auto flex h-[76px] w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-navy text-lg font-black text-white shadow-sm">M</span>
          <span className="text-xl font-black tracking-tight text-navy">Manta<span className="text-sky">360</span></span>
        </Link>
        <nav className="flex items-center gap-3 text-sm font-semibold text-muted">
          {session ? (
            <>
              <span className="hidden lg:inline text-slate-500">{session.fullName} · {ROLE_LABELS[session.role]}</span>
              <Link href={ROLE_HOME[session.role]} className="rounded-md border border-primary px-4 py-2 text-primary transition hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25">Mi panel</Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-md px-3 py-2 transition hover:bg-surface-subtle hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25 sm:inline">Iniciar sesión</Link>
              <Link href="/registro" className="rounded-md bg-accent px-4 py-2.5 text-white shadow-sm transition hover:bg-[#d85c13] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25">Crear cuenta</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
