import Link from "next/link";
import { getSession } from "@/lib/session";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/roles";
import { LogoutButton } from "@/components/logout-button";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-lg font-black text-white shadow-sm">M</span>
          <span className="text-xl font-black tracking-tight text-navy">Manta<span className="text-sky">360</span></span>
        </Link>
        <nav className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          {session ? (
            <>
              <span className="hidden lg:inline text-slate-500">{session.fullName} · {ROLE_LABELS[session.role]}</span>
              <Link href={ROLE_HOME[session.role]} className="rounded-full border border-blue px-4 py-2 text-blue transition hover:bg-blue hover:text-white">Mi panel</Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="hidden sm:inline transition hover:text-blue">Iniciar sesión</Link>
              <Link href="/registro" className="rounded-full bg-orange px-4 py-2.5 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#d85c13]">Crear cuenta</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
