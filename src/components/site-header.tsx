import Link from "next/link";
import { getSession } from "@/lib/session";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/roles";
import { LogoutButton } from "@/components/logout-button";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      <Link href="/" className="font-[family-name:var(--font-fraunces)] text-2xl tracking-tight">
        Manta360
      </Link>
      <nav className="flex items-center gap-4 text-sm text-sand/90">
        {session ? (
          <>
            <span className="hidden sm:inline">
              {session.fullName} · {ROLE_LABELS[session.role]}
            </span>
            <Link
              href={ROLE_HOME[session.role]}
              className="rounded-full border border-[var(--line)] px-4 py-2 transition hover:bg-white/5"
            >
              Mi panel
            </Link>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="transition hover:text-white">
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-full bg-sea px-4 py-2 font-medium text-foam transition hover:bg-sea-deep"
            >
              Registrarse
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
