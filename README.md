# Manta360

> Plataforma web para la gestión segura de arriendos en Manta, Ecuador.

Manta360 conecta a **arrendatarios**, **arrendadores** y al **Municipio** en un flujo único: publicación de inmuebles, verificación de identidad, comunicación privada, generación de contratos y control municipal.

## Características principales

- Catálogo público: las propiedades aprobadas y disponibles pueden verse sin iniciar sesión.
- Registro con nombre completo, cédula, teléfono, correo y contraseña.
- Roles de Arrendador, Arrendatario y Municipio.
- Carga de cédula por frente y reverso o pasaporte, con validación municipal.
- Publicación de propiedades con fotos desde el dispositivo, ubicación y validaciones claras.
- Aprobación municipal de propiedades antes de aparecer en el catálogo público.
- Chat privado entre interesado y dueño de cada propiedad.
- Solicitud, preparación e impresión de contratos.
- Flujo de firmas: ambas partes confirman; luego el Municipio aprueba o rechaza el contrato.
- La propiedad pasa a `OCUPADO` solo después de la aprobación municipal del contrato.
- Solicitudes de renovación para contratos próximos a vencer.
- Reporte de incidencias y quejas: Los arrendatarios con contratos activos pueden reportar problemas; los arrendadores gestionan el estado (Pendiente, En proceso, Resuelto).
- Control administrativo: El Municipio tiene la potestad de inhabilitar temporalmente a arrendadores o propiedades específicas justificando un motivo.

## Tecnologías

- Next.js 15 + React 19 + TypeScript
- Prisma ORM + PostgreSQL
- Supabase Database y Supabase Storage
- Tailwind CSS + Leaflet/OpenStreetMap
- Zod para validaciones y bcrypt para contraseñas

## Requisitos

- Node.js 20 o superior
- npm 10 o superior
- Una cuenta/proyecto de Supabase para el entorno compartido
- Docker Desktop solo si se desea trabajar con PostgreSQL local

## Instalación rápida con Supabase

1. Clona el repositorio y entra a la carpeta:

   ```bash
   git clone https://github.com/Manta360/Manta360.git
   cd Manta360
   ```

2. Instala dependencias:

   ```bash
   npm install
   ```

3. Copia el archivo de ejemplo y configura las variables:

   ```bash
   cp .env.example .env
   ```

   En Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Completa `.env` con las cadenas del proyecto de Supabase. **No subas este archivo a GitHub.**

   ```env
   DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://...:5432/postgres"
   AUTH_SECRET="usa-una-clave-larga-y-privada"
   SUPABASE_URL="https://TU-PROYECTO.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="clave-secreta-solo-del-servidor"
   ```

   - `DATABASE_URL`: pooler transaccional, puerto `6543`.
   - `DIRECT_URL`: pooler de sesión, puerto `5432`, para Prisma.
   - Nunca uses `SUPABASE_SERVICE_ROLE_KEY` en variables `NEXT_PUBLIC_*`.

5. En Supabase Storage crea o verifica estos buckets:

   ```text
   property-images
   identity-documents
   ```

   `identity-documents` debe permanecer privado. Las fotos de propiedades pueden ser públicas porque se muestran en el catálogo.

6. Aplica el esquema y crea el usuario municipal:

   ```bash
   npx prisma db push
   npm run db:seed-municipio
   ```

7. Inicia la aplicación:

   ```bash
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000).

> Nunca uses `npx prisma db push --force-reset` en Supabase: elimina los datos existentes.

## Usuario municipal de desarrollo

El seed crea o actualiza este usuario solo si no se definen otras variables:

```text
Correo: municipio@manta360.gob.ec
Contraseña: Municipio2026!
```

Antes de un despliegue real, define valores propios antes de ejecutar el seed:

```powershell
$env:MUNICIPIO_EMAIL="admin@tu-dominio.ec"
$env:MUNICIPIO_PASSWORD="una-contrasena-fuerte"
$env:MUNICIPIO_NAME="Administrador Municipal"
$env:MUNICIPIO_PHONE="0990000000"
$env:MUNICIPIO_CEDULA="0000000000"
npm run db:seed-municipio
```

## Flujo de alquiler

1. El Arrendador se registra y carga su documento de identidad.
2. El Municipio valida el documento.
3. El Arrendador publica una propiedad; el Municipio la aprueba.
4. Cualquier visitante puede ver la propiedad pública.
5. Un Arrendatario validado contacta al dueño mediante el chat.
6. El Arrendatario solicita el contrato y el Arrendador acepta o rechaza.
7. Ambas partes revisan y confirman sus datos contractuales.
8. El contrato entra en revisión municipal.
9. El Municipio aprueba o rechaza. Al aprobar, el contrato queda activo y la propiedad pasa a ocupada.

## Desarrollo con Docker (opcional)

Para trabajar sin Supabase, inicia PostgreSQL local:

```bash
docker compose up -d
```

En `.env`, usa:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/manta360?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/manta360"
AUTH_SECRET="clave-local-solo-desarrollo"
```

Luego:

```bash
npx prisma db push
npm run db:seed-municipio
npm run dev
```

## Comandos útiles

```bash
npm run dev                 # Desarrollo
npm run build               # Compilación de producción
npm run start               # Ejecutar compilación de producción
npm run lint                # Linter
npm test            # Ejecutar la suite de pruebas (ver TESTING.md para más detalles)
npm run db:generate         # Generar Prisma Client
npm run db:push             # Sincronizar esquema Prisma
npm run db:seed-municipio   # Crear/actualizar usuario municipal
```

## Seguridad y colaboración

- `.env` está ignorado por Git; verifica que nunca se agregue al repositorio.
- No compartas ni publiques contraseñas, URLs con contraseña ni `SUPABASE_SERVICE_ROLE_KEY`.
- Rota cualquier clave que haya sido expuesta en un chat, captura o commit.
- Antes de publicar cambios, ejecuta `npm run lint`, `npm test` y prueba el flujo principal.
- Para colaboración, crea una rama y abre un Pull Request; evita subir directamente a `main`.

## Estructura del proyecto

```text
src/app/              Páginas y rutas API de Next.js
src/components/       Componentes de interfaz
src/lib/              Prisma, autenticación y utilidades
prisma/schema.prisma  Modelo de datos
scripts/              Seeds de desarrollo
TESTING.md            Documentación de la suite de pruebas y cobertura
```

## Equipo

Proyecto Final — Desarrollo de Sistemas de Información.
