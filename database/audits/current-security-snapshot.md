# Snapshot de seguridad de la base original

Fecha de captura: 2026-08-16. La captura se realizó exclusivamente con consultas de catálogos PostgreSQL en modo lectura a la base original, usando el rol de aplicación existente. No contiene credenciales.

## Contexto de conexión

- Rol efectivo: `prisma`.
- `BYPASSRLS`: sí.
- La snapshot no modifica el schema temporal ni aplica políticas automáticamente.

## `chat_messages`

- RLS habilitado: no.
- RLS forzado: no.
- Policies: ninguna.
- Grants relevantes:
  - `prisma`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `TRIGGER` y `TRUNCATE`, con grant option.
  - `service_role`: los mismos privilegios, sin grant option.
- Constraints: solamente `chat_messages_pkey` (`PRIMARY KEY (id)`).
- Índices: PK, `chat_messages_propertyId_createdAt_idx` y `chat_messages_senderId_recipientId_createdAt_idx`.
- Reglas no versionadas: ninguna detectada.

## `users`

- RLS habilitado: sí.
- RLS forzado: sí.
- Policies: ninguna.
- Grants relevantes: `prisma` tiene `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `TRIGGER` y `TRUNCATE`, con grant option.
- Constraints adicionales: ninguna detectada aparte de `users_pkey`.
- Índices: PK, `users_email_key`, `users_nationalId_key` y `users_role_idx`.
- Observación: la conexión de aplicación actual usa un rol con `BYPASSRLS`; la route de Chat no debe apoyarse en RLS como mecanismo de autorización.

## `properties`

- RLS habilitado: no.
- RLS forzado: no.
- Policies: ninguna.
- Grants relevantes: `prisma` tiene `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `TRIGGER` y `TRUNCATE`, con grant option.
- Constraints adicionales no presentes en `database/schema.sql`:
  - `properties_bathrooms_positive_ck`: `bathrooms IS NULL OR bathrooms >= 1` (`NOT VALID`).
  - `properties_bedrooms_positive_ck`: `bedrooms IS NULL OR bedrooms >= 1` (`NOT VALID`).
  - `properties_latitude_range_ck`: `latitude IS NULL OR latitude >= -90 AND latitude <= 90` (`NOT VALID`).
  - `properties_longitude_range_ck`: `longitude IS NULL OR longitude >= -180 AND longitude <= 180` (`NOT VALID`).
  - `properties_monthly_rent_positive_ck`: `monthlyRent > 0` (`NOT VALID`).
  - `properties_title_not_blank_ck`: `length(btrim(title)) > 0` (`NOT VALID`).
- FKs: `properties_createdby_fkey` y `properties_landlordId_fkey` usan `ON UPDATE CASCADE ON DELETE RESTRICT` en la base original.
- Índices: PK, `properties_landlordId_idx`, `properties_status_idx`, `properties_created_by_created_at_id_idx`, `properties_landlord_created_at_id_idx`, `properties_status_created_at_id_idx` y `properties_status_monthly_rent_idx`.

## Conclusión para Chat

`chat_messages` no depende de RLS ni de policies de base de datos. La seguridad de lectura y escritura debe seguir siendo explícita en el servidor: sesión activa, participación de la conversación, propiedad del arrendador y reglas de rol. Las reglas de `properties` se documentan como drift del bootstrap canónico, pero no se aplican automáticamente durante la migración de Chat.
