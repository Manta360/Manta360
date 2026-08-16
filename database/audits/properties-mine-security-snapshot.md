# Snapshot de seguridad de `GET /api/properties/mine`

Captura 2026-08-16 mediante metadata PostgreSQL read-only de la base original. Rol efectivo: `prisma`, con `BYPASSRLS`. No se encontraron policies.

| Tabla | RLS | Policies | Estructura relevante |
| --- | --- | --- | --- |
| `properties` | No | Ninguna | PK; FKs de landlord/creator; índices por landlord/status/fecha/renta |
| `property_images` | Sí, no forzado | Ninguna | PK/FK; único por storage path y hash; único parcial de imagen primaria; índice de orden |
| `property_services` | Sí, no forzado | Ninguna | PK compuesta y FKs a propiedad/catálogo; índice inverso |
| `property_amenities` | Sí, no forzado | Ninguna | PK compuesta y FKs a propiedad/catálogo; índice inverso |
| `service_catalog` | Sí, no forzado | Ninguna | PK, uniques name/slug y checks de no vacío/formato slug |
| `amenity_catalog` | Sí, no forzado | Ninguna | PK, uniques name/slug y checks de no vacío/formato slug |

## Checks históricos de `properties`

- `properties_title_not_blank_ck`: título no vacío (`NOT VALID`).
- `properties_monthly_rent_positive_ck`: renta mayor que cero (`NOT VALID`).
- `properties_bedrooms_positive_ck`: habitaciones nulas o >= 1 (`NOT VALID`).
- `properties_bathrooms_positive_ck`: baños nulos o >= 1 (`NOT VALID`).
- `properties_latitude_range_ck`: latitud nula o entre -90 y 90 (`NOT VALID`).
- `properties_longitude_range_ck`: longitud nula o entre -180 y 180 (`NOT VALID`).

No se aplican estos checks ni las demás reglas históricas al schema temporal en este checkpoint. La lectura no depende de RLS: el repository debe usar exclusivamente `session.sub` como parámetro del filtro de ownership.
