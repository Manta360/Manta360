# GET `/api/contracts` contract freeze

## Classification

**READ + LIFECYCLE SIDE EFFECTS.** After authenticating, the historical GET calls `runContractTransaction((tx) => reconcileExpiredContracts(tx))` before listing contracts. The transaction uses Prisma `Serializable` isolation, retries `P2034` at most three times, and maps a remaining serialization or unique conflict to `409`.

## HTTP contract

- **Authentication:** `getActiveSession()` is required. Without it: `401` `{ error: "Sesión requerida" }`.
- **Lifecycle failure:** transaction conflict: `409` `{ error: "La reconciliacion se debe reintentar" }`; other reconciliation failures: `500` `{ error: "No se pudieron reconciliar contratos vencidos" }`.
- **Listing:** `200` `{ contracts: Contract[] }`, including `{ contracts: [] }` when none match.
- **Query parameters:** none.
- **Order:** `createdAt DESC`.

| Rol/caso | Filtro Prisma histórico | Status | Resultado |
| --- | --- | --- | --- |
| Sin sesión | N/A | 401 | Sesión requerida; lifecycle no se ejecuta |
| `ARRENDATARIO` | `tenantId = session.sub` | 200 | Solo sus contratos |
| `ARRENDADOR` | `landlordId = session.sub` | 200 | Solo sus contratos |
| `MUNICIPIO` | Sin `where` | 200 | Todos los contratos |

## Prisma histórico y forma de salida

La lista era `contracts.findMany({ where, include, orderBy: { createdAt: "desc" } })` con:

| Campo/relación | Proyección histórica | Forma JSON |
| --- | --- | --- |
| Contrato | Todos los campos del modelo `contracts` | IDs, `propertyId`, `tenantId`, `landlordId`, `status`, fechas, firmas, importes, dirección contractual, `endedAt`, `endedBy`, timestamps y nulls existentes |
| Propiedad | `id`, `title`, `address` | `properties` |
| Arrendatario | `contractUserSelect` | `users_contracts_tenantIdTousers`: `id`, `fullName`, `email`, `phone`, `nationalId` |
| Arrendador | `contractUserSelect` | `users_contracts_landlordIdTousers`: los mismos cinco campos |
| Importes | Prisma `Decimal` | `monthlyRent` y `depositAmount`: `null` o `Number(...)` |

Los estados congelados son `PENDIENTE_FIRMA`, `PENDIENTE_MUNICIPIO`, `ACTIVO`, `RECHAZADO_MUNICIPIO`, `FINALIZADO` y `EN_RENOVACION`. Fechas y nulls usan la serialización normal ISO de `NextResponse.json`.

## Reconciliación histórica

- Selecciona contratos `ACTIVO` o `EN_RENOVACION` con `endDate < now` (estrictamente menor; igualdad no vence).
- Actualiza condicionalmente cada uno a `FINALIZADO`, con `endedAt = now`, `endedBy = null` y `updatedAt = now`.
- Solo tras una actualización efectiva, sincroniza su propiedad dentro de la misma transacción.
- La propiedad queda `DISPONIBLE` si no tiene contrato efectivo; `OCUPADO` si aún tiene uno. `MANTENIMIENTO` e `INHABILITADO` nunca son sobrescritos.
