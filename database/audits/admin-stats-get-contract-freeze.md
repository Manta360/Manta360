# GET `/api/admin/stats` contract freeze

## Clasificación y acceso

**READ-ONLY.** El GET histórico solo ejecuta tres consultas agregadas/en paralelo; no llama lifecycle, transacciones, cambios de estado ni escrituras.

| Caso | Status | Resultado |
| --- | --- | --- |
| Sin sesión | 403 | `{ error: "Acceso exclusivo del Municipio" }` |
| `MUNICIPIO` | 200 | Estadísticas municipales |
| `ARRENDADOR` | 403 | `{ error: "Acceso exclusivo del Municipio" }` |
| `ARRENDATARIO` | 403 | `{ error: "Acceso exclusivo del Municipio" }` |

## Consultas, reglas y respuesta históricas

- Propiedades: `properties.findMany` con `approved: true` y `status: { not: "INHABILITADO" }`, seleccionando únicamente `address` y `monthlyRent`.
- Cada dirección se clasifica con `getMunicipalZone`; la normalización, catálogo y fallback permanecen en ese helper. Se agrupa por zona, se ordena por `count DESC`, luego `zone.localeCompare("es-EC")`, y se devuelven las mismas zonas en `propertiesByZone` y `averageRentByZone`.
- Renta promedio: suma exacta con `Prisma.Decimal`, divide por el conteo de su zona y devuelve `number` mediante `.toNumber()`.
- Incidencias: `incident_reports.groupBy({ by: ["status"], _count: { _all: true } })`. La salida siempre contiene `PENDIENTE`, `EN_PROCESO` y `RESUELTO`, con cero para categorías ausentes.
- Top arrendadores: usuarios con `role: "ARRENDADOR"`, ordenados por conteo total de propiedades descendente, `fullName ASC`, `id ASC`, límite cinco. Incluye registros de propiedades históricos, sin filtros por aprobación o estado.
- Response exacto: `{ propertiesByZone, averageRentByZone, incidentsByStatus, topLandlords }`; los COUNT y promedios son `number`. No hay query parameters, fechas, nulls añadidos ni metadatos adicionales.
- `topLandlords` expone exclusivamente `id`, `fullName`, `active`, `propertiesCount`; no expone email, teléfono, documento, hash ni tokens.
