# Contrato congelado de `GET /api/properties/[propertyId]`

| Caso | Comportamiento actual | Status | Response |
| --- | --- | --- | --- |
| Sin sesión | `requireLandlord` rechaza | 401 | `{ error: "Sesión requerida" }` |
| Arrendatario o Municipio | `requireLandlord` rechaza | 403 | `{ error: "Operación no permitida" }` |
| Arrendador propietario | Busca `id` y `landlordId` con imágenes, servicios y amenities | 200 | `{ property }` y cache `no-store` |
| Arrendador ajeno / ID inexistente | `findFirst` no encuentra coincidencia | 404 | `{ error: "Propiedad no encontrada" }` |
| Propiedad INHABILITADO o no aprobada | GET no aplica filtros de status ni approved | 200 si es propia | Shape normal de propiedad |

El shape es idéntico a `/mine`: Decimal convertido a number, timestamps ISO, nulls preservados, imágenes con URL firmada y orden `isPrimary DESC`, `displayOrder ASC`, `createdAt ASC`; servicios y amenities ordenados por su relación. No se incluye landlord, creator, `passwordHash` ni ningún dato de usuario.
