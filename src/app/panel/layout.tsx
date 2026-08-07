import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/session";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/roles";
import { redirect } from "next/navigation";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky">
              Panel {ROLE_LABELS[session.role]}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-navy">
              Hola, {session.fullName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
            {session.role !== "MUNICIPIO" ? <Link href="/panel/documentos" className="text-violet hover:underline">Mis documentos</Link> : null}
            <Link href={ROLE_HOME[session.role]} className="text-blue hover:underline">{session.email}</Link>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
