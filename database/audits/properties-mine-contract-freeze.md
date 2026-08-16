# Contrato congelado de `GET /api/properties/mine`

- Archivo: `src/app/api/properties/mine/route.ts`.
- Método: `GET`, `force-dynamic`, `revalidate = 0` y `Cache-Control: no-store, max-age=0`.
- Autenticación: `getActiveSession()`.
- Roles: solo `ARRENDADOR`; sin sesión `401`, otro rol `403`.
- Filtro de ownership: `landlordId = session.sub`; no recibe parámetros de cliente.
- Orden: propiedades por `createdAt DESC`; imágenes por `isPrimary DESC`, `displayOrder ASC`, `createdAt ASC`; servicios y amenities por relación `createdAt ASC`.

| Campo/relación | Fuente Prisma actual | Regla | Forma JSON |
| --- | --- | --- | --- |
| Propiedad | `properties.findMany` | Propiedades del arrendador autenticado | Campos base, status/approved/disableReason y timestamps ISO |
| Renta/coordenadas | `Decimal` de Prisma | `monthlyRent` siempre; `latitude`/`longitude` nullable | `number`; coordenadas `null` si son null |
| Imágenes | `property_images` incluido | Orden congelado y URL firmada por storage path | `{ id, url, isPrimary, displayOrder }[]`, descarta URLs nulas; `image` es primaria o primera o `null` |
| Servicios | `property_services.service_catalog.name` | Orden de relación ascendente | `string[]` |
| Amenities | `property_amenities.amenity_catalog.name` | Orden de relación ascendente | `string[]` |

La respuesta exitosa es `{ properties }`. Errores: `401`, `403` y `500` con error genérico. `bedrooms`, `bathrooms`, `description`, `latitude`, `longitude` y `disableReason` preservan nulls; `createdAt` y `updatedAt` se envían como ISO strings.
