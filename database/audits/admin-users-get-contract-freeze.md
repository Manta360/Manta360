# GET `/api/admin/users` contract freeze

## Ruta real y acceso

La ruta existe como `GET /api/admin/users` y lista exclusivamente **arrendadores** bajo la clave `{ landlords }`. Comparte archivo con `POST`, pero el GET histórico es **READ-ONLY** y no usa query parameters, búsqueda, paginación ni filtros de actividad.

| Caso | Status | Resultado |
| --- | --- | --- |
| Sin sesión | 403 | `{ error: "Acceso exclusivo del Municipio" }` |
| `MUNICIPIO` | 200 | `{ landlords: [...] }` |
| `ARRENDADOR` | 403 | `{ error: "Acceso exclusivo del Municipio" }` |
| `ARRENDATARIO` | 403 | `{ error: "Acceso exclusivo del Municipio" }` |

## Prisma, orden y respuesta históricos

- Prisma: `user.findMany({ where: { role: "ARRENDADOR" }, select, orderBy: { createdAt: "desc" } })` con `_count.properties_properties_landlordIdTousers`.
- Incluye arrendadores activos e inactivos; el conteo representa todas sus propiedades, sin filtro de estado o aprobación.
- Cada elemento histórico de `landlords` contiene: `id`, `fullName`, `email`, `phone`, `nationalId`, `role`, `active`, `createdAt`, `updatedAt`, `disabledAt`, `disabledBy`, `disableReason`, `propertiesCount`.
- `createdAt`, `updatedAt` y `disabledAt` se serializan como ISO (`disabledAt` permanece `null` cuando no existe). No hay otros campos derivados.
- No se selecciona ni devuelve `passwordHash`, tokens, hashes ni secretos.
