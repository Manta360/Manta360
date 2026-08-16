# Snapshot de seguridad de revisión de identidad

Metadata read-only 2026-08-16: `identity_documents` e `identity_document_reviews` tienen RLS habilitado no forzado y sin policies; `users` tiene RLS habilitado/forzado y sin policies. Rol efectivo `prisma`, `BYPASSRLS=true`. PK/FK, checks, uniques e índices relevantes —incluyendo `identity_documents_current_side_unique`— están documentados en el snapshot de identidad previa. La autorización no dependía de RLS: el handler valida explícitamente `session.role === MUNICIPIO`.
