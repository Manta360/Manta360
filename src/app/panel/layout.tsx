import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return <AppShell role={session.role} fullName={session.fullName} email={session.email}>{children}</AppShell>;
}
