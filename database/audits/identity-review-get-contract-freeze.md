# Contrato congelado GET de revisión de identidad

Solo `MUNICIPIO`: sin sesión `401`; cualquier otro rol `403`. Query param existente `status`: se filtra solo si pertenece a `PENDIENTE`, `EN_REVISION`, `VERIFICADO` o `RECHAZADO`; inválido/no presente lista todo. Prisma usaba `findMany` con ese where, incluye usuarios `user` y `uploadedBy` con solo `id`, `fullName`, `email`, y orden `verificationStatus ASC`, `uploadedAt DESC`.

Response: `{ documents }` con id, usuarios públicos, tipo, side, nombre/MIME/tamaño, estado, uploaded/reviewed/expires ISO/null, reviewNotes, isCurrent y URL firmada de 300s. No expone passwordHash, nationalId, sha256, storagePath ni reviewedBy. PATCH no forma parte de este cambio.
