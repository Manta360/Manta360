# Contrato congelado de `GET /api/properties`

- Método: `GET`, público, `force-dynamic`, `revalidate = 0` y `Cache-Control: no-store, max-age=0`.
- No requiere sesión: visitante, arrendatario, arrendador y municipio reciben la misma respuesta.
- Query params existentes: `minPrice`, `maxPrice` y `services`. Los precios se aplican solo si son números finitos >= 0; `services` es una lista CSV recortada y cada etiqueta exige una relación exacta. No existen otros query params.

| Caso | Regla Prisma actual | Resultado/status | Shape |
| --- | --- | --- | --- |
| Catálogo base | `approved = true` y `status = DISPONIBLE` | 200 | `{ properties: CatalogProperty[] }` |
| `minPrice` / `maxPrice` válidos | `monthlyRent.gte` / `monthlyRent.lte` | 200 | Mismo shape, conjunto acotado |
| Precio inválido o negativo | No agrega condición | 200 | Igual al catálogo base |
| `services` CSV | Un `some(service_catalog.name = etiqueta)` por etiqueta, unidos por AND | 200 | Solo propiedades con todas las etiquetas |
| No aprobada, OCUPADO, MANTENIMIENTO o INHABILITADO | No satisface el where base | 200 | Excluida |
| Error de datos | Catch genérico | 500 | `{ error: "No se pudo cargar el catálogo" }` |

Orden congelado: propiedades `createdAt DESC`; imágenes `isPrimary DESC`, `displayOrder ASC`, `createdAt ASC`; servicios y amenities por fecha de relación ascendente.

## Información pública congelada

| Campo | Público actualmente | Mantener |
| --- | --- | --- |
| Propiedad | `id`, `title`, `address`, `monthlyRent`, `status`, `description`, habitaciones, baños, coordenadas y timestamps | Sí |
| Arrendador | Solo `landlord.id` y `landlord.fullName` | Sí |
| Relaciones | Servicios, amenities, imágenes firmadas y `image` principal | Sí |
| Datos privados | `passwordHash`, email, teléfono, `nationalId`, tokens, estado interno y campos de aprobación | No exponer |
