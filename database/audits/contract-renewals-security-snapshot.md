# Snapshot de seguridad de `GET /api/contract-renewals`

Captura de catálogo **read-only** de la base original el 2026-08-16. No se leyeron datos de negocio ni se realizaron escrituras.

| Tabla | RLS / forced RLS | Policies | Grants históricos | Estructura relevante |
| --- | --- | --- | --- | --- |
| `contract_renewal_requests` | Deshabilitado / no forzado | Ninguna | `prisma` y `service_role`: SELECT y privilegios históricos de escritura | PK `contract_renewal_requests_pkey`; índices `(contractId,status)` y `(requestedBy,status)`; sin FK, CHECK ni trigger en el catálogo actual |
| `contracts` | Deshabilitado / no forzado | Ninguna | `prisma`: SELECT y privilegios históricos de escritura | PK; FKs a propiedad, tenant y arrendador; índices por propiedad/tenant/arrendador y estado |
| `properties` | Deshabilitado / no forzado | Ninguna | `prisma`: SELECT y privilegios históricos de escritura | PK; FKs de propietario/creador; índices de propietario, estado, fecha y renta; checks históricos no validados de título, renta, dormitorios, baños y coordenadas |

No se detectaron policies ni triggers que este endpoint deba reproducir. El nuevo acceso PostgreSQL no depende de RLS: el repository conserva los filtros explícitos derivados de `session.sub` y del rol previamente validado por la Route Handler. No se consulta `users`, por lo que el response no incorpora campos personales ni `passwordHash`.
