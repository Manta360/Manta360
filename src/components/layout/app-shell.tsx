import type { ReactNode } from "react";
import type { Role } from "@/lib/roles";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ChatUnreadProvider } from "@/components/layout/chat-unread-provider";

type AppShellProps = { role: Role; fullName: string; email: string; activePath?: string; children: ReactNode };

export function AppShell({ role, fullName, email, activePath, children }: AppShellProps) {
  return <ChatUnreadProvider role={role}><div className="min-h-screen bg-background text-foreground lg:flex"><Sidebar role={role} activePath={activePath} /><div className="min-w-0 flex-1"><Topbar role={role} fullName={fullName} email={email} /><main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">{children}</main></div></div></ChatUnreadProvider>;
}
