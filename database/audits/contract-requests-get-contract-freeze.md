# GET `/api/contract-requests` contract freeze

## HTTP contract

- **Method:** `GET`; no query parameters are read.
- **Authentication:** `getActiveSession()` is required. Without a session the response is `401` with `{ error: "Sesión requerida" }`.
- **Response:** `200` with `{ requests: ContractRequest[] }`; an empty result is `{ requests: [] }`.
- **Ordering:** `createdAt DESC`.
- **Unhandled database failure:** the historical handler had no local `try/catch`; framework-level generic 500 handling applies. No database details are intentionally serialized by the handler.

| Rol/caso | Filtro Prisma histórico | Status | Resultado |
| --- | --- | --- | --- |
| Sin sesión | N/A | 401 | `{ error: "Sesión requerida" }` |
| `ARRENDATARIO` | `tenantId = session.sub` | 200 | Solo sus solicitudes |
| `ARRENDADOR` | `properties.landlordId = session.sub` | 200 | Solicitudes de sus propiedades |
| `MUNICIPIO` | Sin `where` | 200 | Todas las solicitudes |

## Proyección Prisma histórica

`contract_requests.findMany({ where, include, orderBy })` incluía:

| Campo/relación | Fuente Prisma actual | Regla | Forma JSON |
| --- | --- | --- | --- |
| Solicitud | `contract_requests` | Sin filtro adicional de estado | `id`, `propertyId`, `tenantId`, `status`, `message`, `startDate`, `endDate`, `createdAt`, `updatedAt` |
| Propiedad | `properties` | Relación obligatoria de la solicitud | `{ id, title, address, monthlyRent, landlordId }`; `monthlyRent` se convierte con `Number(...)` |
| Arrendatario | `users` mediante `tenantId` | `contractUserSelect` | `{ id, fullName, email, phone, nationalId }` |

Los estados permanecen exactamente `PENDIENTE`, `APROBADO` y `RECHAZADO`. Las fechas y valores nulos se serializan con el comportamiento normal de `NextResponse.json` (fechas ISO y `null`). `nationalId` es un campo existente en la proyección histórica de este endpoint; no se agregan otros campos privados.
