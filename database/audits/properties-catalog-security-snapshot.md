# Snapshot de seguridad de `GET /api/properties`

Captura read-only 2026-08-16 de la base original. El rol de aplicación `prisma` posee grants históricos; este endpoint solo ejecuta SELECT.

| Tabla | RLS | Policies | Estructura relevante |
| --- | --- | --- | --- |
| `properties` | Deshabilitado | Ninguna | PK, FK a landlord/creator; índices status/fecha/renta; seis CHECK históricos no validados |
| `property_images` | Habilitado, no forzado | Ninguna | FK a propiedad, único por storage/hash, único parcial de imagen primaria e índice de orden |
| `property_services` | Habilitado, no forzado | Ninguna | PK compuesta y FKs a propiedad/catálogo |
| `property_amenities` | Habilitado, no forzado | Ninguna | PK compuesta y FKs a propiedad/catálogo |
| `service_catalog` | Habilitado, no forzado | Ninguna | uniques `name`/`slug` y checks de nombre/slug |
| `amenity_catalog` | Habilitado, no forzado | Ninguna | uniques `name`/`slug` y checks de nombre/slug |
| `users` | Habilitado y forzado | Ninguna | PK y uniques de email/nationalId; el catálogo selecciona solo `id` y `fullName` |

El catálogo no dependía de una policy RLS para filtrar visibilidad: Prisma usaba `approved = true` y `status = DISPONIBLE`. El SQL preserva ambas condiciones y la proyección explícita de usuario.
