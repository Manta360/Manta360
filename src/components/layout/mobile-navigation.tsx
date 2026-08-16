"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/roles";
import { LogoutButton } from "@/components/logout-button";
import { NavigationIcon, roleNavigation } from "@/components/layout/sidebar";

type MobileNavigationProps = { role: Role };

export function MobileNavigation({ role }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    queueMicrotask(() => drawerRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button ref={triggerRef} type="button" aria-label="Abrir navegación" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-md text-primary transition hover:bg-sky/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/25">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[70] bg-navy/55" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div id="mobile-navigation" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navegación de Manta360" className="flex h-full w-[min(23rem,88vw)] flex-col bg-navy p-5 text-white shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <Link data-autofocus href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/50">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-lg font-black text-navy">M</span>
                <span className="text-xl font-black tracking-tight text-white">Manta<span className="text-sky">360</span></span>
              </Link>
              <button type="button" aria-label="Cerrar navegación" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-md text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/50">×</button>
            </div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-sky">{ROLE_LABELS[role]}</p>
            <nav className="mt-3 space-y-1.5" aria-label="Navegación móvil">
              {roleNavigation(role).map((item) => {
                const active = pathname === item.href;
                return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/50 ${active ? "bg-white text-navy" : "text-white/80 hover:bg-white/10 hover:text-white"}`}><NavigationIcon name={item.icon} />{item.label}</Link>;
              })}
            </nav>
            <Link href="/" onClick={() => setOpen(false)} className="mt-3 rounded-lg px-3 py-3 text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky/50">Volver al inicio</Link>
            <div className="mt-auto border-t border-white/15 pt-5"><LogoutButton /></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
