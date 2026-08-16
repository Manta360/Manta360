# Supabase Storage — manta360prueba

## Proyecto

- Project ref verificado: `ycerwszvzkmyisflxkpe`.
- El bootstrap usa exclusivamente `SUPABASE_TEST_URL` y `SUPABASE_TEST_SERVICE_ROLE_KEY`.
- No usa las variables normales de la aplicación ni modifica el proyecto anterior.

## Buckets detectados y configuración

| Bucket | Callers | Privacidad | MIME permitidos | Límite | Path histórico | Signed URL TTL |
| --- | --- | --- | --- | ---: | --- | ---: |
| `property-images` | Catálogo, detalle, propiedades propias y `/api/properties/[propertyId]/images`; uploads y eliminaciones de imágenes | Privado | `image/jpeg`, `image/png`, `image/webp` | 8 MiB | `properties/<propertyId>/<uuid>.<ext>` | 3600 s |
| `identity-documents` | `/api/identity-documents`, revisión municipal y serializers de identidad; uploads y eliminaciones de documentos | Privado | `application/pdf`, `image/jpeg`, `image/png` | 10 MiB | `identity-documents/<userId>/<uuid>.<ext>` | 300 s |

El TTL pertenece a la generación de URLs firmadas de la aplicación; no es una propiedad de configuración del bucket.

## Bootstrap idempotente

- Script: `scripts/bootstrap-supabase-test-storage.ts`.
- Comando: `npm run storage:bootstrap-test`.
- El script valida primero el project ref, lista buckets y solo crea los dos buckets documentados cuando faltan.
- Si un bucket existente difiere en privacidad, MIME o límite, falla sin recrear, borrar ni cambiar buckets.
- No toca buckets desconocidos.

Resultado del bootstrap inicial:

- Creados: `property-images`, `identity-documents`.
- Ya existentes: ninguno de los buckets administrados.
- Ambos verificados como privados, con MIME y límites esperados.

## Policies

No se crearon policies de `storage.objects`.

La aplicación realiza upload, remove y creación de URLs firmadas exclusivamente desde servidor con el cliente de service role. No se detectó acceso funcional directo desde cliente; por tanto, no hay evidencia para crear policies adicionales ni abiertas.

## Verificación segura

Para cada bucket se realizó:

1. Upload de un PNG ficticio diminuto bajo `_bootstrap-check/<uuid>.png`.
2. Generación de URL firmada usando el TTL propio de ese bucket.
3. Comprobación de acceso mediante la URL firmada.
4. Eliminación inmediata del objeto en un bloque de limpieza garantizada.

Resultado: upload, URL firmada, acceso y cleanup correctos para ambos buckets. No quedaron objetos temporales persistentes.

## Seguridad

- No se imprimieron ni documentaron claves, URLs completas ni otros secretos.
- `.env` está ignorado por Git.
- No se copiaron archivos ni se modificaron rutas, Prisma, PostgreSQL o la base/proyecto anterior.
