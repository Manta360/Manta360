import type { PoolClient } from "pg";

export function isAdministrativePropertyStatus(status: string) { return status === "MANTENIMIENTO" || status === "INHABILITADO"; }
export async function propertyHasEffectiveContract(client: PoolClient, propertyId: string) { return (await client.query('SELECT 1 FROM public.contracts WHERE "propertyId" = $1 AND status IN (\'ACTIVO\',\'EN_RENOVACION\') LIMIT 1', [propertyId])).rowCount === 1; }
export async function synchronizePropertyContractState(client: PoolClient, propertyId: string, now = new Date()) {
  const current = await client.query<{ id: string; status: string }>('SELECT id,status FROM public.properties WHERE id = $1 FOR UPDATE', [propertyId]);
  const property = current.rows[0]; if (!property || isAdministrativePropertyStatus(property.status)) return { property, changed: false };
  const expected = await propertyHasEffectiveContract(client, propertyId) ? "OCUPADO" : "DISPONIBLE";
  if (property.status === expected) return { property, changed: false };
  const changed = await client.query('UPDATE public.properties SET status = $2::"PropertyStatus","updatedAt" = $3 WHERE id = $1 AND status IN (\'DISPONIBLE\',\'OCUPADO\')', [propertyId, expected, now]);
  return { property, changed: changed.rowCount === 1 };
}
export async function reservePropertyForContractActivation(client: PoolClient, propertyId: string, now = new Date()) {
  const result = await client.query('UPDATE public.properties SET status = \'OCUPADO\'::"PropertyStatus","updatedAt" = $2 WHERE id = $1 AND status = \'DISPONIBLE\'::"PropertyStatus" AND approved = true', [propertyId, now]);
  return { count: result.rowCount ?? 0 };
}
