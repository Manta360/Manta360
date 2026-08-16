# Contrato congelado de `GET /api/identity-documents`

- Autenticación: `getActiveSession()`; sin sesión responde `401`.
- Roles: solo `ARRENDADOR` y `ARRENDATARIO`; `MUNICIPIO` responde `403`.
- Prisma: `identity_documents.findMany({ where: { userId: session.sub }, orderBy: [{ isCurrent: desc }, { uploadedAt: desc }] })`.
- Incluye historial completo; no filtra solo `isCurrent` y no consulta `identity_document_reviews`.
- No define `Cache-Control`; no existe `404` ni query params.

| Campo/acción | Prisma actual | Regla | Response |
| --- | --- | --- | --- |
| Ownership | `where.userId = session.sub` | No recibe `userId` del cliente | Solo documentos propios |
| Orden | `isCurrent DESC`, `uploadedAt DESC` | Actual antes que histórico; más reciente primero | `documents[]` ordenado |
| Documento | Campos del modelo, serializados selectivamente | Incluye `documentType`, `side`, estado y metadatos de archivo | Sin `storagePath`, `uploadedBy`, `reviewedBy`, `createdAt`, `updatedAt` |
| Revisión | `reviewedAt`, `reviewNotes`, `expiresAt` | Nulls preservados | ISO o `null` |
| Storage | `storagePath` interno | URL firmada 300 s | `downloadUrl` |
| Error | Catch genérico | Sin detalle interno | `500 { error: "No se pudieron cargar los documentos" }` |

`sha256` ya es parte del response actual y debe conservarse. `reviewedBy` no aparece en la respuesta, aunque exista en la tabla.
