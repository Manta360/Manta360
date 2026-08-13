# Suite de Pruebas Técnicas — Manta360

Documentación formal de la suite de testing implementada en el marco de **KAN-28**: *Configuración de la Suite de Testing para Permisos Cruzados*.

## Introducción

Esta suite tiene como propósito validar de forma automatizada tres pilares críticos del sistema:

1. **Seguridad de acceso**: que las rutas administrativas del Municipio no puedan ser ejecutadas por roles no autorizados.
2. **Permisos cruzados**: que un `ARRENDADOR` (u otro rol distinto de `MUNICIPIO`) reciba respuestas `403 Forbidden`, mientras que el rol `MUNICIPIO` pueda operar con validaciones correctas (`400` ante datos inválidos, `200` ante operaciones válidas).
3. **Rendimiento del mapa**: que el componente de mapa sea capaz de renderizar un volumen masivo de pines (100 propiedades) en un tiempo aceptable, sin provocar cuelgues.

Las pruebas no sustituyen la revisión manual en navegador, pero actúan como red de seguridad continua para regresiones en autenticación, autorización y rendimiento de UI.

## Stack Tecnológico

| Herramienta | Uso en Manta360 |
|-------------|-----------------|
| **Vitest** | Runner de pruebas unitarias/integración (Node y jsdom). |
| **React Testing Library** | Renderizado y consultas al DOM en componentes React. |
| **jsdom** | Entorno de navegador simulado para tests `.tsx`. |
| **@vitejs/plugin-react** | Soporte JSX/TSX dentro de Vitest. |
| **@testing-library/jest-dom** | Matchers de aserción orientados al DOM. |

### Estrategia de mocks

- **API admin**: se mockean `@/lib/server-auth` (`getActiveSession`) y `@/lib/prisma` con `vi.mock`, e invocamos los handlers de las rutas App Router directamente (sin levantar el servidor Next ni tocar la base de datos real).
- **Mapa**: se mockean `react-leaflet` y `leaflet` para evitar la dependencia de tiles/WebGL en CI; cada `CircleMarker` se representa como un nodo `data-testid="map-pin"` verificable en el DOM.

## Estructura de Pruebas

### `src/app/api/admin/admin-routes.test.ts`

Pruebas de integración ligera sobre endpoints administrativos del Municipio.

Cobertura actual:

| Caso | Rol simulado | Expectativa |
|------|--------------|-------------|
| Inhabilitar propiedad (`PATCH .../disable`) | `ARRENDADOR` | `403 Forbidden` |
| Listar arrendadores (`GET /api/admin/users`) | `ARRENDADOR` | `403 Forbidden` |
| Inhabilitar sin motivo válido | `MUNICIPIO` | `400 Bad Request` |
| Inhabilitar con motivo válido | `MUNICIPIO` | `200 OK` + propiedad `INHABILITADO` |

Estas pruebas protegen el flujo de **KAN-31** (inhabilitación) frente a accesos cruzados indebidos.

### `src/components/map-render.test.tsx`

Prueba de rendimiento del componente `src/components/Map.tsx`.

- Inyecta un mock de **100 propiedades**.
- Verifica que se rendericen **100 pines** en el DOM.
- Exige que el renderizado complete en **menos de 2000 ms**.

### Otras pruebas existentes

| Archivo | Alcance |
|---------|---------|
| `src/lib/validations/auth.test.ts` | Validaciones de registro, hashing de contraseñas y restricciones de rutas por rol (KAN-10). |

## Configuración

Archivos de soporte en la raíz del repositorio:

- `vitest.config.ts` — plugin React, alias `@/`, `environmentMatchGlobs` (`.test.tsx` → jsdom, resto → node) y `setupFiles`.
- `vitest.setup.ts` — carga de `@testing-library/jest-dom/vitest`.

## Instrucciones de Ejecución

Desde la raíz del proyecto (`Manta360`):

```bash
# Instalar dependencias (incluye las de testing)
npm install

# Ejecutar toda la suite una vez (CI / verificación)
npm test
```

Modo watch (desarrollo):

```bash
npm run test:watch
```

Resultado esperado en un entorno sano:

```text
Test Files  3 passed (3)
     Tests  9 passed (9)
```

## Criterios de aceptación (KAN-28)

- [x] Suite configurada con Vitest + React Testing Library + jsdom.
- [x] Pruebas de permisos cruzados en rutas admin (403 / 400 / 200).
- [x] Prueba de rendimiento del mapa (100 pines &lt; 2 s).
- [x] Comando único documentado: `npm test`.

## Notas para el equipo

- No se requiere base de datos ni sesión real para correr estas pruebas: todo se mockea.
- Si se agregan nuevos endpoints admin, se recomienda extender `admin-routes.test.ts` con casos `403` (rol no municipal) y `200`/`400` (rol municipal).
- El umbral de 2000 ms del mapa es orientativo para máquinas de desarrollo/CI locales; si el entorno es más lento de forma consistente, documentar el nuevo umbral antes de relajarlo.
