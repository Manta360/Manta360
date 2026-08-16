# Snapshot de seguridad de `GET /api/admin/stats`

Captura de catálogo **read-only** de la base original el 2026-08-16. No se leyeron datos de negocio ni se realizaron escrituras.

| Tabla | RLS / forced RLS | Policies | Grants históricos | Estructura relevante |
| --- | --- | --- | --- | --- |
| `properties` | Deshabilitado / no forzado | Ninguna | `prisma`: SELECT y privilegios históricos de escritura | PK; FKs de propietario/creador; índices de propietario, estado, fecha y renta; checks históricos no validados de título, renta, dormitorios, baños y coordenadas |
| `incident_reports` | Deshabilitado / no forzado | Ninguna | `prisma`: SELECT y privilegios históricos de escritura | PK; FKs a contrato, propiedad, tenant y arrendador; índices `(contractId,status)`, `(tenantId,status)`, `(landlordId,status)` |
| `users` | Habilitado / forzado | Ninguna | `prisma`: SELECT y privilegios históricos de escritura | PK; únicos email/nationalId; índice `users_role_idx` |

No se detectaron triggers ni policies que este endpoint deba reproducir. El repository no usa RLS como autorización: la Route Handler exige explícitamente el rol `MUNICIPIO`. La proyección de usuarios evita `users.*` y no incluye `passwordHash`, tokens, email, teléfono o `nationalId`.
