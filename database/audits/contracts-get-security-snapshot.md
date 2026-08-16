# Snapshot de seguridad de `GET /api/contracts`

Captura de catálogo **read-only** de la base de aplicación el 2026-08-16. No se consultaron ni modificaron datos de negocio.

| Tabla usada | RLS | Policies | Grants históricos `prisma` | Estructura relevante |
| --- | --- | --- | --- | --- |
| `contracts` | Deshabilitado, no forzado | Ninguna | SELECT y privilegios históricos de escritura | PK; FKs a propiedad, tenant y landlord con `ON UPDATE CASCADE`; índices por landlord/property/tenant y estado |
| `properties` | Deshabilitado, no forzado | Ninguna | SELECT y privilegios históricos de escritura | PK; FKs; índices de estado/landlord; checks históricos no validados de título, renta, dormitorios, baños y coordenadas |
| `users` | Habilitado y forzado | Ninguna | SELECT y privilegios históricos de escritura | PK; únicos de email/nationalId e índice por rol |

No se detectaron triggers ni policies que el endpoint deba reproducir. La autorización de lectura depende de filtros explícitos derivados de `session.sub`/`session.role`, no de RLS.

## Invariantes en `manta360prueba`

La verificación de esquema temporal es la fuente para el nuevo path PostgreSQL:

- KAN-43: índice parcial `contracts_one_effective_contract_per_property` para `ACTIVO` y `EN_RENOVACION`.
- KAN-44: `contracts_end_date_after_start_date`.
- KAN-46: columnas `endedAt` y `endedBy`, e índice `contracts_status_end_date_idx`.

La base de aplicación histórica no recibió escritura en este checkpoint y su catálogo no es usado como fuente para aplicar DDL.
