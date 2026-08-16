# Snapshot de seguridad de `my-dashboard` en la base original

Fecha de captura: 2026-08-16. Se usaron únicamente consultas read-only a catálogos PostgreSQL. No se incluyen credenciales ni se aplican cambios a la base temporal.

## Contexto

- Rol efectivo: `prisma`.
- `BYPASSRLS`: sí.
- Policies encontradas en las tablas auditadas: ninguna.

| Tabla | RLS enabled | RLS forced | Grants relevantes | Índices y constraints relevantes |
| --- | --- | --- | --- | --- |
| `users` | Sí | Sí | `prisma`: privilegios completos con grant option | PK, email/nationalId únicos, índice `users_role_idx` |
| `properties` | No | No | `prisma`: privilegios completos con grant option | Índices por landlord/status; checks históricos de título, renta, habitaciones, baños, latitud y longitud |
| `chat_messages` | No | No | `prisma` y `service_role`: privilegios completos | PK e índices por propiedad/participantes/fecha |
| `identity_documents` | Sí | No | `prisma` y `service_role`: privilegios completos | PK, storage path único, índices por usuario/status; checks de extensión, mime type, tamaño, hash y notas de rechazo |
| `contract_requests` | No | No | `prisma`: privilegios completos con grant option | PK, FKs a propiedad/arrendatario e índices por propiedad/arrendatario y estado |

## Reglas históricas adicionales

- `properties` conserva seis checks no versionados en `database/schema.sql`, todos `NOT VALID`.
- `identity_documents` conserva checks de formatos de archivo, hash, tamaño y nota obligatoria al rechazar.
- Las FKs de `properties`, `identity_documents` y `contract_requests` incluyen `ON UPDATE CASCADE` en la base original.

## Conclusión

El endpoint no depende de policies RLS para sus reglas de negocio: usa `getActiveSession()` y todas las consultas se limitan a `session.sub`. El rol actual de aplicación tiene `BYPASSRLS`, por lo que el repository PostgreSQL directo debe preservar los filtros de usuario en SQL y no asumir que RLS los impondrá.
