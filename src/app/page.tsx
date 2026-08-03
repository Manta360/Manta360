import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/session";
import { ROLE_HOME } from "@/lib/roles";

const roles = [
  { title: "Arrendatario", text: "Encuentra un hogar seguro, consulta opciones y gestiona tus solicitudes.", color: "bg-blue", icon: "⌂" },
  { title: "Arrendador", text: "Publica tus propiedades y conecta con personas que buscan vivir en Manta.", color: "bg-orange", icon: "▣" },
  { title: "Municipio", text: "Impulsa una ciudad ordenada con información y seguimiento confiable.", color: "bg-violet", icon: "✦" },
];

export default async function HomePage() {
  const session = await getSession();
  return (
    <div className="min-h-screen bg-[#f8fafc]"><SiteHeader />
      <main>
        <section className="relative isolate overflow-hidden bg-navy">
          <div className="absolute inset-0 -z-10 bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=85')] bg-cover bg-center opacity-40" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/80 to-blue/30" />
          <div className="mx-auto grid min-h-[540px] w-full max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.1fr_.9fr]">
            <div className="max-w-2xl text-white">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky/50 bg-navy/30 px-4 py-2 text-sm font-semibold text-sky"><span className="h-2 w-2 rounded-full bg-sky" /> Municipio de Manta</p>
              <h1 className="text-5xl font-black leading-[1.03] tracking-tight sm:text-7xl">Habitabilidad<br /><span className="text-sky">costera en Manta.</span></h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-blue-50">La plataforma oficial que conecta hogares, propietarios y Municipio para construir una ciudad más segura, ordenada y accesible.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href={session ? ROLE_HOME[session.role] : "/registro"} className="rounded-full bg-orange px-6 py-3.5 font-bold text-white shadow-lg shadow-orange/20 transition hover:-translate-y-1 hover:bg-[#d85c13]">{session ? "Ir a mi panel" : "Comenzar ahora"} <span className="ml-2">→</span></Link>
                <Link href="#roles" className="rounded-full border border-white/40 bg-white/10 px-6 py-3.5 font-bold text-white backdrop-blur transition hover:bg-white/20">Conoce Manta360</Link>
              </div>
            </div>
            <div className="hidden lg:block"><div className="ml-auto max-w-sm rounded-3xl border border-white/20 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-md"><p className="text-sm font-semibold text-sky">UNA CIUDAD QUE AVANZA</p><p className="mt-3 text-3xl font-bold leading-tight">Tu próximo hogar empieza aquí.</p><div className="mt-8 flex items-center gap-3"><div className="h-12 w-12 rounded-full bg-orange/90" /><div><p className="font-bold">Conexiones con propósito</p><p className="text-sm text-blue-100">Información pública y segura</p></div></div></div></div>
          </div>
        </section>
        <section id="roles" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8"><div className="max-w-2xl"><p className="font-bold uppercase tracking-[.2em] text-orange">Una plataforma para todos</p><h2 className="mt-3 text-4xl font-black tracking-tight text-navy sm:text-5xl">Hacemos equipo por Manta.</h2><p className="mt-4 text-lg text-slate-600">Cada rol tiene las herramientas necesarias para vivir, ofrecer y gestionar mejor.</p></div><div className="mt-10 grid gap-5 md:grid-cols-3">{roles.map((role) => <article key={role.title} className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-blue/10"><div className={`grid h-12 w-12 place-items-center rounded-2xl ${role.color} text-2xl font-bold text-white`}>{role.icon}</div><h3 className="mt-6 text-xl font-bold text-navy">{role.title}</h3><p className="mt-3 leading-7 text-slate-600">{role.text}</p><span className="mt-6 inline-block font-bold text-blue transition group-hover:translate-x-1">Saber más →</span></article>)}</div></section>
        <section className="mx-auto mb-20 max-w-6xl px-5 sm:px-8"><div className="overflow-hidden rounded-3xl bg-[#e7f5fb] p-8 sm:p-12"><div className="max-w-2xl"><p className="font-bold text-violet">Manta, nuestro hogar</p><h2 className="mt-3 text-3xl font-black text-navy sm:text-4xl">Más cerca de lo que necesitas.</h2><p className="mt-4 text-slate-600">Accede a información confiable y oportunidades habitacionales pensadas para nuestra comunidad.</p><Link href="/login" className="mt-7 inline-block font-bold text-blue hover:text-navy">Ya tengo una cuenta →</Link></div></div></section>
      </main>
    </div>
  );
}
