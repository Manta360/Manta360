# Snapshot de seguridad de `GET /api/contract-requests`

Captura de catálogo **read-only** de la base original el 2026-08-16. No se leyeron ni modificaron datos de negocio.

| Tabla | RLS | Policies | Grants del rol histórico `prisma` | Estructura relevante |
| --- | --- | --- | --- | --- |
| `contract_requests` | Deshabilitado, no forzado | Ninguna | SELECT y privilegios históricos de escritura | PK `contract_requests_pkey`; FKs de propiedad y arrendatario con `ON UPDATE/DELETE CASCADE`; índices `(propertyId,status)` y `(tenantId,status)` |
| `properties` | Deshabilitado, no forzado | Ninguna | SELECT y privilegios históricos de escritura | PK; FKs landlord/creator; índices de landlord, estado, fecha y renta; checks históricos no validados de título, renta, dormitorios, baños y coordenadas |
| `users` | Habilitado y forzado | Ninguna | SELECT y privilegios históricos de escritura | PK, únicos de email/nationalId e índice de rol |

No se detectaron triggers para estas tablas ni políticas que el endpoint deba reproducir. La conexión histórica de aplicación (`prisma`) tiene grants y la lectura no dependía exclusivamente de RLS. La autorización funcional depende de los filtros derivados en servidor de `session.sub` y `session.role`; el repository PostgreSQL conserva esos filtros parametrizados.

La proyección de usuario se limita al contrato histórico: `id`, `fullName`, `email`, `phone` y `nationalId`. No incluye `passwordHash`, tokens ni otros metadatos de cuenta.
