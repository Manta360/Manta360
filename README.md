# Manta360

Proyecto Final — Desarrollo de Sistemas de Información.

## KAN-10 · Módulo de Registro y Autenticación

Incluye:

- Registro público con rol obligatorio **Arrendador** o **Arrendatario** (`/registro`)
- Login con redirección al panel del rol (`/login`)
- Middleware que bloquea URLs de paneles ajenos (`/panel/*`)
- Contraseñas con **bcrypt** (nunca se exponen al cliente)
- Rol **Municipio** solo por alta manual en PostgreSQL

### Base de datos

La base es **PostgreSQL en Supabase**, accedida con Prisma. La app se conecta con un
rol dedicado `prisma` a través del pooler de Supabase (Supavisor), porque la conexión
directa a `db.<ref>.supabase.co` solo está disponible sobre IPv6.

| Variable | Puerto | Para qué |
| --- | --- | --- |
| `DATABASE_URL` | 6543 | Consultas de la app (modo transacción, `pgbouncer=true`) |
| `DIRECT_URL` | 5432 | `prisma db push` y migraciones (modo sesión) |

La tabla `users` tiene RLS activado y sin políticas, y se revocaron los permisos de
`anon` y `authenticated`. Así la Data API de Supabase no puede leer los hashes de
contraseña; solo el rol `prisma` (que tiene `bypassrls`) llega a los datos.

### Arranque local

```bash
cp .env.example .env   # completa las cadenas de Supabase
npm install
npm run db:push
npm run db:seed-municipio
npm run dev
```

- App: http://localhost:3000
- Municipio por defecto: `municipio@manta360.gob.ec` / `Municipio2026!`

Para trabajar sin Supabase, `docker compose up -d` levanta un PostgreSQL local;
apunta `DATABASE_URL` y `DIRECT_URL` a él (ver `.env.example`).

### Pruebas

```bash
npm test
```

### SQL manual (KAN-14)

También puedes insertar el municipio con `prisma/seed-municipio.sql` tras generar un hash bcrypt.
