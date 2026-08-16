# Snapshot de seguridad de identidad

Captura read-only 2026-08-16 de la base original. Rol efectivo de aplicación: `prisma`, con `BYPASSRLS=true` y grants históricos de SELECT y escritura; el endpoint GET solo realiza SELECT.

| Tabla | RLS | Policies | Reglas relevantes |
| --- | --- | --- | --- |
| `identity_documents` | Habilitado, no forzado | Ninguna | PK; FKs de usuario/uploader/reviewer; únicos de storage path, sha256 actual y documento actual por user/type/side; checks de extensión, MIME, tamaño, hash y notas al rechazar |
| `identity_document_reviews` | Habilitado, no forzado | Ninguna | PK; FKs de documento/reviewer; checks de cambio de estado y notas al rechazar |
| `users` | Habilitado y forzado | Ninguna | PK y uniques; GET no hace JOIN |

Índices relevantes: `identity_documents_user_uploaded_idx`, `identity_documents_status_uploaded_idx`, `identity_documents_current_side_unique`, `identity_documents_current_sha256_idx` y los índices de revisión. No hay triggers. Defaults relevantes: UUID, `PENDIENTE`, `UNICA`, `isCurrent=true` y timestamps.

La seguridad de lectura no dependía exclusivamente de RLS: el endpoint Prisma filtraba `userId = session.sub`. El repository conserva ese filtro explícito y parametrizado.
