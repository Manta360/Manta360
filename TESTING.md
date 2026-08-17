# Suite de Pruebas Técnicas — Manta360

Documentación de las pruebas automatizadas del repositorio. Para el **guion de demo en vivo** y checklist de despliegue, ver también [`docs/pruebas-y-demo.md`](docs/pruebas-y-demo.md).

## Objetivos

1. **Seguridad y permisos** — roles cruzados, IDOR y datos sensibles (KAN-28, KAN-61).
2. **Ciclo de negocio** — terminación contractual y propiedad en `DISPONIBLE` (KAN-60).
3. **Regresiones de API/UI** — rutas, repositorios y componentes críticos.
4. **Rendimiento de mapa** — 100 pines en tiempo aceptable (KAN-28).

Las pruebas no sustituyen la revisión manual en navegador, pero reducen regresiones en autenticación, autorización y flujos contractuales.

## Stack

| Herramienta | Uso |
|-------------|-----|
| **Vitest** | Unitarias / integración de handlers y componentes |
| **React Testing Library + jsdom** | Tests `.tsx` |
| **tsx + PostgreSQL (`PG_TEST_*`)** | Scripts E2E/integración reales (rollback) |

### Estrategia de mocks (Vitest)

- Sesión: `getActiveSession` / `getSession`.
- Repositorios `.server` o `applicationPostgres.connect` según la ruta.
- Mapa: mocks de `react-leaflet` / `leaflet` (`data-testid="map-pin"`).
- **Prisma ya no se usa** en la aplicación ni en los tests nuevos.

## Cómo ejecutar

```bash
npm install
npm test                 # toda la suite Vitest
npm run test:watch       # modo watch
```

### KAN-61 — 12 escenarios de permisos/seguridad

```bash
npx vitest run src/tests/security-permissions.test.ts
```

Cobertura: visitante sin token, arrendatario vs propiedades, propiedad ajena, registro como `MUNICIPIO`, contrato/incidencia ajenos, renovación fuera de 15 días, propiedad ocupada/inhabilitada, arrendador inhabilitado, contratos duplicados y no exposición de `passwordHash`.

### KAN-60 — E2E API happy path (PostgreSQL de prueba)

Requiere `PG_TEST_*` en `.env`:

```bash
npm run db:check-test
npm run db:test-e2e-happy-path
```

Flujo: arrendador → propiedad → aprobación municipal → catálogo → arrendatario → buscar → solicitar → aceptar → contrato → `OCUPADO` → queja → resolver → municipio ve todo → terminar → **`DISPONIBLE`** (todo en `BEGIN`/`ROLLBACK`).

### Otros scripts útiles de integración

```bash
npm run db:test-contracts
npm run db:test-admin-stats
# ver package.json → scripts db:test-*
```

## Mapa de suites relevantes

| Ubicación | Alcance |
|-----------|---------|
| `src/tests/security-permissions.test.ts` | KAN-61 — 12 escenarios de seguridad |
| `scripts/test-e2e-happy-path.ts` | KAN-60 — E2E integración |
| `src/app/api/admin/admin-routes.test.ts` | Permisos admin / inhabilitación (KAN-28/31) |
| `src/components/map-render.test.tsx` | 100 pines &lt; 2 s |
| `src/lib/property-contract-state.test.ts` | Sync contrato ↔ propiedad |
| `src/app/api/contracts/contract-termination.test.ts` | Terminación API |
| `src/**/*.test.ts(x)` | Resto de regresiones por módulo |

## Configuración

- `vitest.config.ts` — plugin React, alias `@/`, jsdom para `.tsx`.
- `vitest.setup.ts` — `@testing-library/jest-dom/vitest`.

## Criterios de aceptación

- [x] Vitest + RTL + jsdom configurados (KAN-28).
- [x] Permisos cruzados admin (KAN-28/31).
- [x] Rendimiento del mapa (KAN-28).
- [x] Suite de seguridad de 12 escenarios (KAN-61).
- [x] E2E happy path hasta `DISPONIBLE` (KAN-60).
- [x] Comando único de Vitest: `npm test`.

## Notas para el equipo

- La mayoría de Vitest **no** necesita BD real (mocks).
- El E2E KAN-60 **sí** necesita `PG_TEST_*` al proyecto de prueba autorizado.
- Al agregar endpoints sensibles, extender `security-permissions.test.ts` o el test de la ruta.
- El umbral de 2000 ms del mapa es orientativo; si CI es más lento de forma estable, documentar el nuevo umbral antes de relajarlo.
