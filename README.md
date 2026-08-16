# Manta360

Plataforma web para la gestión segura de arriendos en Manta, Ecuador. Conecta arrendatarios, arrendadores y Municipio para publicar inmuebles, verificar identidad, gestionar contratos, renovaciones, incidencias y comunicación privada.

## Tecnología

- Next.js 15, React 19 y TypeScript
- PostgreSQL directo mediante `pg` (node-postgres)
- Supabase Storage
- Tailwind CSS, Leaflet/OpenStreetMap, Zod y bcrypt

Prisma ya no forma parte de la aplicación: el esquema canónico está en [database/schema.sql](database/schema.sql).

## Requisitos

- Node.js 20 o superior
- npm 10 o superior
- Un proyecto Supabase PostgreSQL y Storage autorizado

## Instalación

```bash
git clone https://github.com/Manta360/Manta360.git
cd Manta360
npm install
```

Copia el archivo de configuración:

```bash
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Nunca subas `.env` al repositorio.

## Variables de entorno

La aplicación usa exclusivamente `PG_APP_*`; no existe fallback a `DATABASE_URL`.

```env
PG_APP_HOST="aws-0-[REGION].pooler.supabase.com"
PG_APP_PORT="5432"
PG_APP_DATABASE="postgres"
PG_APP_USER="postgres.ycerwszvzkmyisflxkpe"
PG_APP_PASSWORD="clave-de-aplicacion"
PG_APP_PROJECT_REF="ycerwszvzkmyisflxkpe"

AUTH_SECRET="usa-una-clave-larga-y-privada"

SUPABASE_URL="https://TU-PROYECTO.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="clave-secreta-solo-del-servidor"
```

- `PG_APP_*` usa el Session Pooler de Supabase por el puerto `5432`.
- `PG_APP_PROJECT_REF` se valida al iniciar para impedir conexiones accidentales a otro proyecto. El target actual autorizado es `manta360prueba` (`ycerwszvzkmyisflxkpe`).
- Las pruebas de integración usan variables separadas `PG_TEST_*`.
- El bootstrap de Storage temporal usa `SUPABASE_TEST_URL` y `SUPABASE_TEST_SERVICE_ROLE_KEY`.
- Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` ni `SUPABASE_TEST_SERVICE_ROLE_KEY` mediante variables `NEXT_PUBLIC_*`.

Consulta [.env.example](.env.example) para el inventario completo, incluidos los valores de prueba y `MUNICIPIO_PASSWORD`.

## Base de datos

`database/schema.sql` es la fuente canónica del esquema PostgreSQL. Incluye tablas, enums, claves, índices, restricciones contractuales y los checks históricos de Properties.

Antes de ejecutar procesos que escriban, valida la conexión de aplicación:

```bash
npm run db:check-app
```

La comprobación verifica el project ref esperado y ejecuta un INSERT dentro de `BEGIN`/`ROLLBACK`; no deja datos persistentes.

## Storage

Los buckets requeridos son privados:

| Bucket | MIME permitidos | Límite | URL firmada |
| --- | --- | ---: | ---: |
| `property-images` | JPEG, PNG, WebP | 8 MiB | 3600 s |
| `identity-documents` | PDF, JPEG, PNG | 10 MiB | 300 s |

El bootstrap idempotente para el proyecto de prueba se ejecuta con:

```bash
npm run storage:bootstrap-test
```

No crea policies abiertas ni deja objetos temporales después de su verificación.

## Seed municipal

El seed es PostgreSQL e idempotente. Requiere `MUNICIPIO_PASSWORD` y no imprime contraseñas ni hashes.

```powershell
$env:MUNICIPIO_EMAIL="admin@tu-dominio.ec"
$env:MUNICIPIO_PASSWORD="una-contrasena-fuerte"
$env:MUNICIPIO_NAME="Administrador Municipal"
$env:MUNICIPIO_PHONE="0990000000"
$env:MUNICIPIO_CEDULA="0000000000"
npm run db:seed-municipio
```

## Comandos útiles

```bash
npm run dev                 # Desarrollo
npm run build               # Compilación de producción
npm run start               # Ejecutar producción
npm run lint                # Linter
npm test                    # Suite de pruebas
npm run db:check-app        # Verifica PG_APP_* con rollback
npm run db:seed-municipio   # Crea o actualiza el usuario municipal
```

## Flujo de alquiler

1. El arrendador registra y valida su identidad.
2. El Municipio revisa la identidad y aprueba la propiedad.
3. El arrendatario solicita un contrato.
4. Arrendador y arrendatario completan las firmas.
5. El Municipio aprueba o rechaza el contrato.
6. Una aprobación activa el contrato y sincroniza la propiedad como ocupada.
7. El flujo cubre incidencias, renovación y terminación/expiración contractual.

## Estructura

```text
src/app/              Páginas y Route Handlers de Next.js
src/components/       Componentes de interfaz
src/lib/              Conexión PostgreSQL, autenticación y utilidades
src/repositories/     Repositories PostgreSQL
database/schema.sql   Esquema canónico PostgreSQL
scripts/              Seeds, validaciones e integraciones
```

## Seguridad y colaboración

- No compartas contraseñas, connection strings o service-role keys.
- Ejecuta `npm test`, `npm run lint` y `npm run build` antes de publicar cambios.
- Trabaja en una rama y abre Pull Requests; evita subir directamente a `main`.
