import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <p className="font-[family-name:var(--font-fraunces)] text-4xl tracking-tight">
            Iniciar sesión
          </p>
          <p className="max-w-md text-sand/75">
            Entra con tu correo y contraseña. Te llevamos al panel de tu rol y
            bloqueamos rutas que no te corresponden.
          </p>
        </section>
        <section className="rounded-3xl border border-[var(--line)] bg-[#122029]/70 p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <Suspense fallback={<p className="text-sand/70">Cargando...</p>}>
            <LoginForm />
          </Suspense>
          <p className="mt-5 text-sm text-sand/65">
            ¿Nuevo en Manta360?{" "}
            <Link
              href="/registro"
              className="text-sea underline-offset-2 hover:underline"
            >
              Regístrate
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
