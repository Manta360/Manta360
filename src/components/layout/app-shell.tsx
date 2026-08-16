import type { ReactNode } from "react";
import type { Role } from "@/lib/roles";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

type AppShellProps = { role: Role; fullName: string; email: string; children: ReactNode };

export function AppShell({ role, fullName, email, children }: AppShellProps) {
  return <div className="min-h-screen bg-background text-foreground lg:flex"><Sidebar role={role} /><div className="min-w-0 flex-1"><Topbar role={role} fullName={fullName} email={email} /><main className="relative mx-auto w-full max-w-[96rem] px-5 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-10"><div className="mx-auto w-full max-w-7xl">{children}</div></main></div></div>;
}
