# GET `/api/contract-renewals` contract freeze

## Clasificación

**READ-ONLY.** El GET histórico no invoca reconciliación, transacciones, cambios de estado, creación de renovaciones ni sincronización de propiedades.

| Rol/caso | Filtro histórico | Status HTTP | Visibilidad |
| --- | --- | --- | --- |
| Sin sesión | No autorizado | 403 | `{ error: "Sesion no autorizada" }` |
| `ARRENDATARIO` | Contratos con `tenantId === session.sub` | 200 | Renovaciones de esos contratos, por fecha descendente |
| `ARRENDADOR` | Contratos con `landlordId === session.sub` | 200 | Renovaciones de esos contratos, por fecha descendente |
| `MUNICIPIO` | No admitido | 403 | `{ error: "Sesion no autorizada" }` |

## Query y respuesta históricos

- Prisma primero ejecuta `contracts.findMany` con el filtro derivado exclusivamente de `session.role` y `session.sub`; selecciona `id`, `startDate`, `endDate`, `status` y `properties { id, title, address }`.
- Si no hay contratos propios responde `{ renewals: [] }` con `200` sin consultar renovaciones.
- Después ejecuta `contract_renewal_requests.findMany({ where: { contractId: { in: ids } }, orderBy: { createdAt: "desc" } })` y adjunta el contrato encontrado en memoria como `contract`.
- Cada elemento de `renewals` conserva: `id`, `contractId`, `requestedBy`, `proposedEndDate`, `status`, `createdAt`, `updatedAt` y `contract` anidado.
- El contrato anidado conserva únicamente `id`, `startDate`, `endDate`, `status` y `properties { id, title, address }`.
- No hay joins de usuario, `reviewedAt`, `reviewedBy`, notas, importes ni otros campos contractuales en este response. Timestamps se serializan como ISO y los valores nulos se mantienen como `null` mediante `NextResponse.json`.
- Estados de renovación congelados: `PENDIENTE`, `APROBADO`, `RECHAZADO`.

La ruta no consume query parameters ni acepta IDs de usuario, arrendatario o arrendador del cliente.
