"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ROLE_HOME, isRole, type Role } from "@/lib/roles";

type Contract = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  monthlyRent?: string | number;
  depositAmount?: string | number;
  city?: string;
  purpose?: string;
  paymentMethod?: string;
  properties: { title: string; address: string };
  users_contracts_tenantIdTousers: { fullName: string; nationalId?: string };
  users_contracts_landlordIdTousers: { fullName: string; nationalId?: string };
};

const date = (value: string) => new Date(value).toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" });

function safePanelReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith("/panel/") || value.includes("//") || value.includes("\\")) return null;
  return value;
}

function contractsPathForRole(role: Role) {
  if (role === "MUNICIPIO") return "/panel/municipio/contratos";
  return `${ROLE_HOME[role]}/contratos`;
}

function ContractPageContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backHref, setBackHref] = useState(safePanelReturnPath(searchParams.get("from")) ?? "/");

  useEffect(() => {
    const from = safePanelReturnPath(searchParams.get("from"));
    if (from) {
      setBackHref(from);
      return;
    }
    let cancelled = false;
    void fetch("/api/auth/me")
      .then(async (response) => {
        const data = await response.json();
        if (cancelled || !response.ok) return;
        const role = data.user?.role;
        if (isRole(role)) setBackHref(contractsPathForRole(role));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    fetch(`/api/contracts/${id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setContract(data.contract);
      })
      .catch((reason) => setError(reason.message));
  }, [id]);

  if (error) return <main className="mx-auto max-w-3xl p-8 text-red-700">{error}</main>;
  if (!contract) return <main className="mx-auto max-w-3xl p-8">Cargando contrato...</main>;

  const tenant = contract.users_contracts_tenantIdTousers;
  const landlord = contract.users_contracts_landlordIdTousers;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href={backHref} className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-navy">Volver</Link>
        <a href={`/api/contracts/${contract.id}/pdf`} className="rounded-lg bg-blue px-4 py-2 font-bold text-white">Descargar PDF</a>
      </div>
      <article className="contract-paper rounded-sm bg-white p-8 text-justify text-[13px] leading-6 text-slate-800 shadow">
        <h1 className="mb-8 text-center text-xl font-black">CONTRATO DE ARRENDAMIENTO</h1>
        <p>
          En la ciudad de <b>{contract.city || "Manta"}</b>, a los <b>{date(contract.startDate)}</b>, comparecen <b>{landlord.fullName}</b>, C.I. <b>{landlord.nationalId || "________________"}</b>, como ARRENDADOR; y <b>{tenant.fullName}</b>, C.I. <b>{tenant.nationalId || "________________"}</b>, como ARRENDATARIO.
        </p>
        <Clause title="PRIMERA - OBJETO">El inmueble <b>{contract.properties.title}</b> se encuentra ubicado en <b>{contract.properties.address}</b>.</Clause>
        <Clause title="SEGUNDA - DESTINO">El inmueble se destinara a <b>{contract.purpose || "vivienda"}</b>.</Clause>
        <Clause title="TERCERA - PLAZO">El plazo inicia el <b>{date(contract.startDate)}</b> y termina el <b>{date(contract.endDate)}</b>.</Clause>
        <Clause title="CUARTA - CANON">El canon mensual acordado es <b>${contract.monthlyRent ?? "________"}</b>. Forma de pago: <b>{contract.paymentMethod || "por definir entre las partes"}</b>.</Clause>
        <Clause title="QUINTA - GARANTIA">La garantia indicada es <b>${contract.depositAmount ?? "________"}</b>.</Clause>
        <p className="mt-7">Leido que fue el presente contrato, las partes lo aceptan.</p>
        <div className="mt-20 grid grid-cols-2 gap-10 text-center">
          <div className="border-t border-slate-700 pt-2"><b>ARRENDADOR</b><br />{landlord.fullName}</div>
          <div className="border-t border-slate-700 pt-2"><b>ARRENDATARIO</b><br />{tenant.fullName}</div>
        </div>
        <p className="mt-8 text-center text-xs text-slate-500">Estado en Manta360: {contract.status}.</p>
      </article>
    </main>
  );
}

function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return <p className="mt-4"><b>{title}.</b> {children}</p>;
}

export default function ContractPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl p-8">Cargando contrato...</main>}>
      <ContractPageContent />
    </Suspense>
  );
}
