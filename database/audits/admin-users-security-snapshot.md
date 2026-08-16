# Snapshot de seguridad de `GET /api/admin/users`

Captura de catálogo **read-only** de la base original el 2026-08-16. No se leyeron datos de negocio ni se realizaron escrituras.

| Tabla | RLS / forced RLS | Policies | Grants históricos | Estructura relevante |
| --- | --- | --- | --- | --- |
| `users` | Habilitado / forzado | Ninguna | `prisma`: SELECT y privilegios históricos de escritura | PK `users_pkey`; únicos `users_email_key` y `users_nationalId_key`; índice `users_role_idx`; sin CHECK ni trigger |
| `properties` | No consultada como entidad de respuesta; usada solo para `COUNT` | N/A | N/A | FK `properties_landlordId_fkey` hacia `users`; su conteo histórico no filtra registros |

Referencian `users` además `contract_requests`, `contracts`, `identity_documents`, `identity_document_reviews` e `incident_reports`, con FKs históricas de restricción/cascade según cada relación. No hay policies que el endpoint deba reproducir: la Route Handler exige `MUNICIPIO` antes de consultar. La proyección SQL evita `users.*` y excluye `passwordHash`, tokens y secretos.
