# Snapshot de seguridad del detalle de propiedad

Captura read-only 2026-08-16 de `properties`, `property_images`, `property_services`, `property_amenities`, `service_catalog` y `amenity_catalog`.

- `properties`: RLS deshabilitado.
- Las otras cinco tablas: RLS habilitado, no forzado, sin policies.
- Rol de aplicación previamente confirmado: `prisma` con `BYPASSRLS`.
- Grants, PK/FK, uniques e índices relevantes coinciden con [properties-mine-security-snapshot.md](./properties-mine-security-snapshot.md).
- Los seis CHECK históricos de `properties` (título, renta, habitaciones, baños, latitud, longitud) continúan documentados allí y no se aplican al schema temporal en este checkpoint.

El detalle no depende de RLS para ownership: la consulta SQL debe requerir `id = $1` y `landlordId = $2`.
