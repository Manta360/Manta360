# Guía de despliegue — Manta360

## Entorno local (reproducible)

### Requisitos

- Node.js **20+** y npm **10+**
- Proyecto PostgreSQL (recomendado: Supabase) + Storage
- Git

### Pasos

```bash
git clone https://github.com/Manta360/Manta360.git
cd Manta360
npm install
```

```powershell
Copy-Item .env.example .env
```

Completa en `.env` al menos: `PG_APP_*`, `AUTH_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Base de datos

Opción A — entregable académico completo (creación + seed demo):

```bash
psql "$CONNECTION_STRING" -f database/BDD.sql
```

Opción B — bootstrap de aplicación + municipio:

1. Ejecutar `database/schema.sql`
2. `npm run db:seed-municipio` con `MUNICIPIO_PASSWORD`

Validar conexión de aplicación:

```bash
npm run db:check-app
```

### Storage

Buckets privados `property-images` e `identity-documents` (ver README). En entorno de prueba:

```bash
npm run storage:bootstrap-test
```

### Ejecutar

```bash
npm run dev      # http://localhost:3000
npm run build
npm run start    # producción local
```

---

## Producción con IP pública o dominio (rúbrica 30%)

La rúbrica exige el sistema accesible por **IP pública o dominio**. El patrón recomendado:

1. **Base de datos y Storage** en la nube (Supabase u otro PostgreSQL gestionado).  
2. **Aplicación Next.js** en un VPS / PaaS (Railway, Render, Fly.io, DigitalOcean, AWS Lightsail, etc.).  
3. Variables de entorno de producción equivalentes a `.env.example` (`PG_APP_*` de producción, `AUTH_SECRET` fuerte, service role solo servidor).  
4. Build:

```bash
npm ci
npm run build
npm run start
```

5. Exponer el puerto HTTPS (o HTTP detrás de reverse proxy Nginx/Caddy) hacia `0.0.0.0` / balanceador.  
6. Verificar desde un dispositivo externo: `http://IP_PUBLICA:PUERTO` o `https://tu-dominio`.

### Checklist de producción

- [ ] `AUTH_SECRET` único y largo  
- [ ] Sin `NEXT_PUBLIC_` para service roles  
- [ ] `PG_APP_PROJECT_REF` coincide con el proyecto real  
- [ ] Seed de municipio (o `database/BDD.sql`) aplicado  
- [ ] `npm run build` sin errores  
- [ ] URL/IP pública anotada en el informe individual (3-Pager)  

### Notas

- Vercel es viable para el front/SSR, pero PostgreSQL externo sigue siendo obligatorio (`PG_APP_*`).  
- No subas `.env` al repositorio.  
- Documenta la URL de despliegue en el README del equipo cuando esté activa.
