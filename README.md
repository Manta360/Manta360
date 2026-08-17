# Manta360

<table>
  <tr>
    <td>
      <strong>Pontificia Universidad Católica del Ecuador — Sede Manabí</strong><br/>
      Carrera de Ingeniería de Software<br/>
      Asignatura: Desarrollo de Sistemas de Información · Período 2026-1<br/>
      Docente: Ing. José Naranjo, M.Eng.
    </td>
  </tr>
</table>

Plataforma web para la gestión de arriendos en **Manta, Ecuador**. Integra en una sola aplicación a **visitantes**, **arrendatarios**, **arrendadores** y **Municipio**: publicación de inmuebles, búsqueda, contratos, renovaciones, quejas/mantenimiento, estadísticas e inhabilitación administrativa.

| | |
|---|---|
| **Repositorio** | https://github.com/Manta360/Manta360 |
| **Tablero Jira (planeación)** | https://manta360.atlassian.net/jira/software/projects/KAN/summary |
| **Script de BD (rúbrica)** | [`database/BDD.sql`](database/BDD.sql) |
| **Documentación técnica** | [`docs/`](docs/) |
| **URL / IP de producción** | https://manta360.vercel.app |

---

## Tabla de contenidos

1. [Funcionamiento general](#1-funcionamiento-general)
2. [Arquitectura y metodología](#2-arquitectura-y-metodología)
3. [Modelo de datos y BDD.sql](#3-modelo-de-datos-y-bddsql)
4. [Entorno reproducible (instalación local)](#4-entorno-reproducible-instalación-local)
5. [Despliegue en producción (IP pública)](#5-despliegue-en-producción-ip-pública)
6. [Manual por rol](#6-manual-por-rol)
7. [Pruebas automatizadas y demo](#7-pruebas-automatizadas-y-demo)
8. [Estructura del repositorio](#8-estructura-del-repositorio)
9. [Documentación adicional](#9-documentación-adicional)

---

## 1. Funcionamiento general

Manta360 cumple los módulos del enunciado oficial del proyecto:

1. Registro y autenticación (arrendador / arrendatario; municipio por seed en BD).
2. Gestión de propiedades (crear, editar, eliminar con validaciones, cambiar estado).
3. Solicitudes y contratos (aceptación, PDF, terminación, renovación en ventana de 15 días).
4. Quejas y mantenimiento (pendiente / en proceso / resuelto).
5. Búsqueda y disponibilidad (visitante: catálogo básico; arrendatario: filtros).
6. Panel municipal (listados, estadísticas por zona, inhabilitación).

Flujo de negocio resumido:

```text
Arrendador publica → Municipio aprueba propiedad → Visitante/Arrendatario ve catálogo
→ Solicitud → Aceptación → Firmas → Aprobación municipal → Contrato ACTIVO (OCUPADO)
→ Quejas / renovación / terminación → Propiedad DISPONIBLE
```

---

## 2. Arquitectura y metodología

- **Metodología:** Scrum/Kanban con Jira (épicas `KAN-*`), ramas `feature/KAN-*` y Pull Requests a `main`.
- **Tablero de planeación:** [manta360.atlassian.net/jira/software/projects/KAN/summary](https://manta360.atlassian.net/jira/software/projects/KAN/summary) — evidencia del flujo metodológico grupal (épicas, sprints/estados y asignación).
- **Estilo:** monolito modular (Next.js App Router + repositorios PostgreSQL). Sin microservicios.
- **Stack:** Next.js 15, React 19, TypeScript, PostgreSQL (`pg`), Supabase Storage, Tailwind, Zod, bcrypt, Vitest.

Diagrama de arquitectura (Mermaid): ver [`docs/arquitectura.md`](docs/arquitectura.md).

```mermaid
flowchart TB
  UI[UI Next.js por rol] --> API[Route Handlers /api]
  API --> REPO[repositories/]
  REPO --> PG[(PostgreSQL)]
  API --> ST[(Storage)]
```

---

## 3. Modelo de datos y BDD.sql

Entregable de rúbrica: **[`database/BDD.sql`](database/BDD.sql)**

Incluye el esquema **completo** (todas las tablas del sistema: usuarios, propiedades, catálogos, imágenes, solicitudes, contratos, renovaciones, quejas, identidad, chat) más un **seed mínimo** de demostración.

| Usuario demo | Rol | Contraseña |
|--------------|-----|------------|
| `municipio@manta360.demo` | MUNICIPIO | `Demo1234!` |
| `arrendador@manta360.demo` | ARRENDADOR | `Demo1234!` |
| `arrendatario@manta360.demo` | ARRENDATARIO | `Demo1234!` |

También se inserta una propiedad **aprobada** en Centro de Manta (visible en catálogo) y un contrato/queja históricos para historial.

Diagrama DER **completo** (14 tablas): [`docs/modelo-datos.md`](docs/modelo-datos.md).  
Bootstrap sin seed (uso diario del equipo): [`database/schema.sql`](database/schema.sql).

```bash
psql "postgresql://USER:PASS@HOST:5432/postgres?sslmode=require" -f database/BDD.sql
```

---

## 4. Entorno reproducible (instalación local)

### Requisitos

- Node.js 20+ / npm 10+
- PostgreSQL accesible (Session Pooler Supabase puerto `5432` recomendado)
- Buckets de Storage privados

### Instalación

```bash
git clone https://github.com/Manta360/Manta360.git
cd Manta360
npm install
```

```powershell
Copy-Item .env.example .env
```

Configura las variables documentadas en [`.env.example`](.env.example):

| Variable | Uso |
|----------|-----|
| `PG_APP_*` | PostgreSQL de la aplicación (obligatorio) |
| `PG_TEST_*` | PostgreSQL para E2E/integración |
| `AUTH_SECRET` | Firma del JWT de sesión |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Storage de aplicación |
| `MUNICIPIO_PASSWORD` | Solo para `npm run db:seed-municipio` |

```bash
npm run db:check-app
npm run dev
```

Abre `http://localhost:3000`.

Migraciones futuras (append-only): carpeta [`database/migrations/`](database/migrations/). El esquema base se aplica con `database/BDD.sql` / `database/schema.sql`.

Seed solo municipio (alternativa al seed de `database/BDD.sql`):

```powershell
$env:MUNICIPIO_PASSWORD="una-contrasena-fuerte"
npm run db:seed-municipio
```

Guía ampliada: [`docs/despliegue.md`](docs/despliegue.md).

---

## 5. Despliegue en producción (IP pública)

La rúbrica exige acceso por **IP pública o dominio**. Procedimiento resumido:

1. Provisionar PostgreSQL + Storage en la nube.
2. Aplicar `database/BDD.sql` (o `database/schema.sql` + seed).
3. Desplegar la app Node en VPS/PaaS con las mismas variables de `.env.example` (valores de producción).
4. Ejecutar:

```bash
npm ci
npm run build
npm run start
```

5. Exponer HTTPS/HTTP en IP pública o dominio y verificar desde un dispositivo externo.

Detalle, checklist y opciones de hosting: [`docs/despliegue.md`](docs/despliegue.md).

**URL / IP de producción del equipo:** https://manta360.vercel.app

---

## 6. Manual por rol

Resumen; detalle completo en [`docs/manual-usuario.md`](docs/manual-usuario.md).

| Rol | Puede |
|-----|--------|
| **Visitante** | Ver propiedades disponibles/aprobadas sin login |
| **Arrendatario** | Filtrar, solicitar, contratos, PDF, terminar, renovar (15 días), quejas |
| **Arrendador** | Publicar/editar/eliminar propiedades, solicitudes, contratos, quejas |
| **Municipio** | Todo el sistema: listados, stats, aprobar, inhabilitar (creado en BD) |

---

## 7. Pruebas automatizadas y demo

```bash
# Suite completa Vitest
npm test

# KAN-61 — 12 escenarios de permisos/seguridad
npx vitest run src/tests/security-permissions.test.ts

# KAN-60 — E2E API happy path (requiere PG_TEST_*)
npm run db:test-e2e-happy-path
```

Guion de demostración en vivo y fallos frecuentes: [`docs/pruebas-y-demo.md`](docs/pruebas-y-demo.md).

---

## 8. Estructura del repositorio

```text
src/app/                 Páginas y Route Handlers
src/components/          UI por rol y módulos
src/lib/                 Auth, validaciones, PDF, sync de estados
src/repositories/        Acceso PostgreSQL
src/tests/               Suites transversales (seguridad KAN-61)
database/BDD.sql         Script oficial completo + seed (rúbrica)
database/schema.sql      Bootstrap canónico sin seed
database/migrations/     Migraciones append-only
docs/                    Arquitectura, DER completo, manual, despliegue, pruebas
scripts/                 Seeds, E2E e integraciones PostgreSQL
```

---

## 9. Documentación adicional

| Documento | Contenido |
|-----------|-----------|
| [docs/arquitectura.md](docs/arquitectura.md) | Capas, despliegue, módulos |
| [docs/modelo-datos.md](docs/modelo-datos.md) | DER Mermaid **completo** (14 tablas) y estados |
| [docs/despliegue.md](docs/despliegue.md) | Local + producción / IP pública |
| [docs/manual-usuario.md](docs/manual-usuario.md) | Manual por rol (6 módulos) |
| [docs/pruebas-y-demo.md](docs/pruebas-y-demo.md) | Vitest, E2E, guion de demo |
| [TESTING.md](TESTING.md) | Suite de pruebas (KAN-28/60/61) |

---

## Seguridad y colaboración

- Nunca subir `.env`, contraseñas ni service-role keys.
- No exponer secretos con prefijo `NEXT_PUBLIC_`.
- Antes de PR: `npm test`, `npm run lint`, `npm run build`.
- Trabajo en ramas y Pull Requests; evitar push directo a `main`.
