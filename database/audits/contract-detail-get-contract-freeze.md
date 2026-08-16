# GET `/api/contracts/[id]` contract freeze

## Classification

**READ-ONLY.** El GET histórico no llama reconciliación, transacciones, `contract-lifecycle`, sincronización de propiedad ni retries. Solo autentica, consulta por ID y aplica acceso en servidor.

| Caso | Acceso histórico | Status | Resultado |
| --- | --- | --- | --- |
| Sin sesión | No permitido | 401 | `{ error: "Sesión requerida" }` |
| Arrendatario participante | `tenantId === session.sub` | 200 | `{ contract }` |
| Arrendatario ajeno | No participante | 404 | `{ error: "Contrato no encontrado" }` |
| Arrendador participante | `landlordId === session.sub` | 200 | `{ contract }` |
| Arrendador ajeno | No participante | 404 | `{ error: "Contrato no encontrado" }` |
| Municipio | Acceso sin filtro de participación | 200 | `{ contract }` |
| ID inexistente | No encontrado | 404 | `{ error: "Contrato no encontrado" }` |

## Query y response históricos

- Prisma: `contracts.findUnique({ where: { id }, include })`.
- Includes: `properties: true`, tenant y landlord con `contractUserSelect`.
- La autorización ocurre **después** de buscar por ID; nunca se acepta user/role del cliente.
- `properties` incluía todos sus campos del modelo: propietario, dirección, renta, estado, fechas, ubicación, aprobación e inhabilitación.
- Contract incluye todos los campos del modelo, incluidos importes, firmas, dirección contractual, `endedAt`, `endedBy`, `createdAt` y `updatedAt`.
- Tenant/landlord se serializan solo como `id`, `fullName`, `email`, `phone`, `nationalId`; no se incluye `passwordHash`, tokens ni metadatos internos.
- `Decimal` conserva la representación JSON histórica de Prisma; timestamps y nulls conservan el formato ISO/null de `NextResponse.json`.
- Estados congelados: `PENDIENTE_FIRMA`, `PENDIENTE_MUNICIPIO`, `ACTIVO`, `RECHAZADO_MUNICIPIO`, `FINALIZADO`, `EN_RENOVACION`.

Las tablas consultadas (`contracts`, `properties`, `users`) y su metadata read-only ya fueron auditadas en `contracts-get-security-snapshot.md`; no se requieren escrituras ni lifecycle para este GET.
