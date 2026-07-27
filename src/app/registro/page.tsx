import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <p className="font-[family-name:var(--font-fraunces)] text-4xl tracking-tight">
            Registro
          </p>
          <p className="max-w-md text-sand/75">
            Crea tu cuenta como Arrendador o Arrendatario. El acceso municipal se
            provisiona solo por base de datos.
          </p>
        </section>
        <section className="rounded-3xl border border-[var(--line)] bg-[#122029]/70 p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <RegisterForm />
          <p className="mt-5 text-sm text-sand/65">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-sea underline-offset-2 hover:underline">
              Inicia sesión
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
