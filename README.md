# Manta360

Proyecto Final — Desarrollo de Sistemas de Información.

## KAN-10 · Módulo de Registro y Autenticación

Incluye:

- Registro público con rol obligatorio **Arrendador** o **Arrendatario** (`/registro`)
- Login con redirección al panel del rol (`/login`)
- Middleware que bloquea URLs de paneles ajenos (`/panel/*`)
- Contraseñas con **bcrypt** (nunca se exponen al cliente)
- Rol **Municipio** solo por alta manual en PostgreSQL

### Arranque local

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:push
npm run db:seed-municipio
npm run dev
```

- App: http://localhost:3000
- Municipio por defecto: `municipio@manta360.gob.ec` / `Municipio2026!`

### Pruebas

```bash
npm test
```

### SQL manual (KAN-14)

También puedes insertar el municipio con `prisma/seed-municipio.sql` tras generar un hash bcrypt.
