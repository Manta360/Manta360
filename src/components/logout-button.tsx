"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogout() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudo cerrar la sesión");
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("No se pudo cerrar la sesión. Intenta nuevamente.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onLogout}
        disabled={loading}
        className="rounded-full border border-slate-300 px-4 py-2 text-slate-700 transition hover:border-blue hover:text-blue disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "Saliendo..." : "Salir"}
      </button>
      {error ? <span role="alert" className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
