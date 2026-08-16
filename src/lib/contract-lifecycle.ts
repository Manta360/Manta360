import type { PoolClient } from "pg";
import { synchronizePropertyContractState } from "@/lib/property-contract-state";
export const terminableContractStatuses = ["ACTIVO", "EN_RENOVACION"] as const;
export function isTerminableContractStatus(status: string) { return terminableContractStatuses.includes(status as (typeof terminableContractStatuses)[number]); }
/** Canonical automatic expiration: endDate < now, endedBy NULL, property synced atomically. */
export async function reconcileExpiredContracts(client: PoolClient, now = new Date()) {
  const expired = await client.query<{ id: string; propertyId: string }>('SELECT id,"propertyId" FROM public.contracts WHERE status IN (\'ACTIVO\',\'EN_RENOVACION\') AND "endDate" < $1 FOR UPDATE', [now]);
  let finalized = 0;
  for (const contract of expired.rows) {
    const changed = await client.query('UPDATE public.contracts SET status = \'FINALIZADO\'::"ContractStatus","endedAt" = $2,"endedBy" = NULL,"updatedAt" = $2 WHERE id = $1 AND status IN (\'ACTIVO\',\'EN_RENOVACION\') AND "endDate" < $2', [contract.id, now]);
    if (changed.rowCount !== 1) continue;
    finalized += 1; await synchronizePropertyContractState(client, contract.propertyId, now);
  }
  return finalized;
}
