import type { QueryResultRow } from "pg";

/** Minimal SQL client shared by PoolClient and repository executors. */
export type PropertyContractStateClient = {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[]; rowCount?: number | null }>;
};

export function isAdministrativePropertyStatus(status: string) {
  return status === "MANTENIMIENTO" || status === "INHABILITADO";
}

export async function propertyHasEffectiveContract(client: PropertyContractStateClient, propertyId: string) {
  const result = await client.query(
    'SELECT 1 FROM public.contracts WHERE "propertyId" = $1 AND status IN (\'ACTIVO\',\'EN_RENOVACION\') LIMIT 1',
    [propertyId],
  );
  return result.rows.length > 0;
}

/**
 * Keeps DISPONIBLE/OCUPADO coherent with effective contracts.
 * Never overrides administrative statuses (MANTENIMIENTO / INHABILITADO).
 */
export async function synchronizePropertyContractState(
  client: PropertyContractStateClient,
  propertyId: string,
  now = new Date(),
) {
  const current = await client.query<{ id: string; status: string }>(
    'SELECT id,status FROM public.properties WHERE id = $1 FOR UPDATE',
    [propertyId],
  );
  const property = current.rows[0];
  if (!property || isAdministrativePropertyStatus(property.status)) return { property, changed: false };

  const expected = (await propertyHasEffectiveContract(client, propertyId)) ? "OCUPADO" : "DISPONIBLE";
  if (property.status === expected) return { property, changed: false };

  const changed = await client.query(
    'UPDATE public.properties SET status = $2::"PropertyStatus","updatedAt" = $3 WHERE id = $1 AND status IN (\'DISPONIBLE\',\'OCUPADO\')',
    [propertyId, expected, now],
  );
  return { property, changed: (changed.rowCount ?? 0) === 1 };
}

export async function reservePropertyForContractActivation(
  client: PropertyContractStateClient,
  propertyId: string,
  now = new Date(),
) {
  const result = await client.query(
    'UPDATE public.properties SET status = \'OCUPADO\'::"PropertyStatus","updatedAt" = $2 WHERE id = $1 AND status = \'DISPONIBLE\'::"PropertyStatus" AND approved = true',
    [propertyId, now],
  );
  return { count: result.rowCount ?? 0 };
}

/** Manual termination path used by API and E2E: FINALIZADO + liberar propiedad. */
export async function finalizeContractAndSynchronizeProperty(
  client: PropertyContractStateClient,
  input: { contractId: string; propertyId: string; endedBy: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const finalized = await client.query(
    'UPDATE public.contracts SET status = \'FINALIZADO\'::"ContractStatus","endedAt" = $2,"endedBy" = $3,"updatedAt" = $2 WHERE id = $1 AND status IN (\'ACTIVO\',\'EN_RENOVACION\')',
    [input.contractId, now, input.endedBy],
  );
  if ((finalized.rowCount ?? 0) !== 1) {
    return { finalized: false as const };
  }
  await synchronizePropertyContractState(client, input.propertyId, now);
  return { finalized: true as const };
}
