import { NextResponse } from "next/server";
import { isContractTransactionConflict, runContractTransaction } from "@/lib/contract-exclusivity";
import { synchronizePropertyContractState } from "@/lib/property-contract-state";
import { getActiveSession } from "@/lib/server-auth";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSession();
  if (!session || session.role !== "MUNICIPIO") {
    return NextResponse.json({ error: "Acceso exclusivo del Municipio" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const result = await runContractTransaction(async (tx) => {
      const existing = await tx.properties.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!existing) return { error: "Propiedad no encontrada", status: 404 };
      if (existing.status !== "INHABILITADO") return { error: "La propiedad no esta inhabilitada", status: 409 };

      const now = new Date();
      await tx.properties.update({
        where: { id },
        data: {
          status: "DISPONIBLE",
          approved: false,
          approvedAt: null,
          approvedBy: null,
          disabledAt: null,
          disabledBy: null,
          disableReason: null,
          updatedAt: now,
        },
      });
      await synchronizePropertyContractState(tx, id, now);
      return { property: await tx.properties.findUnique({ where: { id } }) };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({
      property: { ...result.property!, monthlyRent: Number(result.property!.monthlyRent) },
    });
  } catch (error) {
    if (isContractTransactionConflict(error)) {
      return NextResponse.json({ error: "La propiedad cambio durante la rehabilitacion" }, { status: 409 });
    }
    console.error("property enable error", error);
    return NextResponse.json({ error: "No se pudo rehabilitar la propiedad" }, { status: 500 });
  }
}
