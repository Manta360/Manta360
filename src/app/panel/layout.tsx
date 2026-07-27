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
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-sand/55">
              Panel {ROLE_LABELS[session.role]}
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl">
              Hola, {session.fullName}
            </h1>
          </div>
          <Link
            href={ROLE_HOME[session.role]}
            className="text-sm text-sea hover:underline"
          >
            {session.email}
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
