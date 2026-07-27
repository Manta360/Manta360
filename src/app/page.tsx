import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/session";
import { ROLE_HOME } from "@/lib/roles";

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="relative mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-5xl flex-col justify-end px-6 pb-16 pt-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[58vh] bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center opacity-40"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[58vh] bg-gradient-to-b from-transparent via-[#0f1c24]/40 to-[#0f1c24]"
        />

        <section className="relative z-10 max-w-xl space-y-5">
          <p className="font-[family-name:var(--font-fraunces)] text-5xl leading-none tracking-tight sm:text-6xl">
            Manta360
          </p>
          <h1 className="text-xl text-sand/90 sm:text-2xl">
            Habitabilidad costera con roles claros y acceso seguro.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-sand/70">
            Los visitantes ven solo información pública. Correos, teléfonos y
            datos de gestión quedan protegidos tras autenticación.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {session ? (
              <Link
                href={ROLE_HOME[session.role]}
                className="rounded-full bg-sea px-5 py-3 font-semibold transition hover:bg-sea-deep"
              >
                Ir a mi panel
              </Link>
            ) : (
              <>
                <Link
                  href="/registro"
                  className="rounded-full bg-sea px-5 py-3 font-semibold transition hover:bg-sea-deep"
                >
                  Crear cuenta
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-[var(--line)] px-5 py-3 transition hover:bg-white/5"
                >
                  Iniciar sesión
                </Link>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
