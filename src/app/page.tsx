import Link from "next/link";
import { RentalCatalog } from "@/components/rental-catalog";
import { RoleExplorer } from "@/components/role-explorer";
import { SiteHeader } from "@/components/site-header";
import { ROLE_HOME } from "@/lib/roles";
import { getSession } from "@/lib/session";

const roles = [
  { title: "Arrendatario", text: "Encuentra un hogar, conversa con el propietario y gestiona tus solicitudes.", icon: "⌂", href: "/registro" },
  { title: "Arrendador", text: "Publica y administra tus propiedades con acompañamiento municipal.", icon: "▣", href: "/registro" },
  { title: "Municipio", text: "Revisa información, documentos y propiedades desde un solo espacio.", icon: "✦", href: "/login" },
];

const steps = [
  { number: "01", title: "Explora", text: "Encuentra propiedades disponibles en Manta." },
  { number: "02", title: "Conecta", text: "Conversa directamente con el propietario." },
  { number: "03", title: "Formaliza", text: "Gestiona solicitudes, firmas y contratos." },
  { number: "04", title: "Da seguimiento", text: "Consulta documentos e incidencias con claridad." },
];

export default async function HomePage() {
  const session = await getSession();
  const panelHref = session ? ROLE_HOME[session.role] : null;
  const primaryHref = panelHref ?? "#catalogo";

  return <div className="min-h-screen bg-background"><SiteHeader /><main>
    <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[1fr_.92fr] lg:gap-16 lg:py-20">
      <div className="max-w-2xl"><p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-primary"><span className="h-2 w-2 rounded-full bg-sky" /> Vivienda y gestión en Manta</p><h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-navy sm:text-5xl lg:text-6xl">Encuentra tu próximo hogar en Manta.</h1><p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Explora propiedades verificadas, conecta con propietarios y gestiona tu alquiler de forma clara y segura.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href={primaryHref} className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-navy">{panelHref ? "Ir a mi panel" : "Explorar propiedades"}</Link><Link href="#como-funciona" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-5 py-3 text-sm font-semibold text-primary transition hover:border-sky hover:bg-surface-subtle">Conocer Manta360</Link></div><ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><li className="flex items-center gap-2"><span className="text-success">✓</span> Propiedades verificadas</li><li className="flex items-center gap-2"><span className="text-success">✓</span> Gestión segura</li><li className="flex items-center gap-2"><span className="text-success">✓</span> Seguimiento municipal</li></ul></div>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-2 shadow-md"><div className="min-h-[300px] rounded-xl bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=85')] bg-cover bg-center sm:min-h-[390px]" role="img" aria-label="Costa de Manta"><div className="flex h-full min-h-[300px] items-end bg-gradient-to-t from-navy/55 via-transparent to-transparent p-5 sm:min-h-[390px] sm:p-7"><div className="max-w-sm rounded-lg border border-white/30 bg-white/92 p-4 text-navy shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.15em] text-primary">Manta360</p><p className="mt-1 text-lg font-semibold leading-6">Una experiencia de alquiler más clara para Manta.</p></div></div></div></div>
    </section>

    <section id="como-funciona" className="border-y border-border bg-surface"><div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-16"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-sky">Proceso claro</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-3xl">Cómo funciona Manta360</h2><p className="mt-3 leading-7 text-muted-foreground">Herramientas conectadas para encontrar, formalizar y dar seguimiento a un arriendo.</p></div><ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step) => <li key={step.number} className="border-l-2 border-sky pl-4"><span className="text-xs font-semibold tracking-[.14em] text-primary">{step.number}</span><h3 className="mt-2 text-base font-semibold text-navy">{step.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p></li>)}</ol></div></section>

    <section id="roles" className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-16"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-sky">Una plataforma para todos</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-3xl">Una experiencia clara para cada rol.</h2><p className="mt-3 leading-7 text-muted-foreground">Cada persona cuenta con herramientas enfocadas en su momento dentro del proceso de arriendo.</p></div><div className="mt-8 grid gap-4 md:grid-cols-3">{roles.map((role) => <article key={role.title} className="app-card flex min-h-56 flex-col p-5"><span className="grid h-10 w-10 place-items-center rounded-lg bg-sky/10 text-lg font-semibold text-primary">{role.icon}</span><h3 className="mt-5 text-lg font-semibold text-navy">{role.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{role.text}</p><Link href={panelHref ?? role.href} className="mt-auto pt-5 text-sm font-semibold text-primary transition hover:text-navy">Conocer experiencia →</Link></article>)}</div></section>

    <section className="mx-auto w-full max-w-7xl px-5 pb-14 sm:px-8 sm:pb-16"><RoleExplorer /></section>

    <section id="catalogo" className="border-t border-border bg-surface"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16"><div className="mb-7 max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-sky">Catálogo público</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-3xl">Propiedades disponibles</h2><p className="mt-3 leading-7 text-muted-foreground">Explora las propiedades y el mapa sin crear una cuenta. Regístrate solo cuando quieras contactar al arrendador.</p></div><RentalCatalog /></div></section>
  </main></div>;
}
