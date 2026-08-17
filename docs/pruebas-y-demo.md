# Guía de pruebas y demostración en vivo — Manta360

## 1. Pruebas automatizadas (Vitest)

Desde la raíz del repositorio, con dependencias instaladas:

```bash
npm test
```

### KAN-61 — Permisos y seguridad (12 escenarios)

```bash
npx vitest run src/tests/security-permissions.test.ts
```

Cubre: visitante sin token, arrendatario vs propiedades, propiedad ajena, registro como MUNICIPIO, contrato/incidencia ajenos, renovación fuera de 15 días, propiedad ocupada/inhabilitada, arrendador inhabilitado, contratos duplicados y no exposición de `passwordHash`.

### Otras suites unitarias / de rutas

```bash
npx vitest run src/lib/property-contract-state.test.ts
npx vitest run src/app/api/contracts/contract-termination.test.ts
```

## 2. E2E de integración PostgreSQL (KAN-60)

Requiere variables `PG_TEST_*` en `.env` apuntando al proyecto de prueba autorizado.

```bash
npm run db:check-test
npm run db:test-e2e-happy-path
```

El script recorre: registro arrendador → propiedad → aprobación municipal → catálogo visitante → arrendatario → buscar → solicitar → aceptar → contrato → OCUPADO → queja → resolver → municipio ve todo → terminar → **DISPONIBLE**.

Todo corre dentro de `BEGIN`/`ROLLBACK` (no deja basura en BD).

## 3. Checklist de demostración en vivo (rúbrica 30% despliegue)

### Preparación

1. Aplicar `database/BDD.sql` (o `database/schema.sql` + seed municipio).  
2. Configurar `.env` desde `.env.example`.  
3. `npm install && npm run build && npm start` (o el proceso del hosting).  
4. Confirmar URL/IP pública accesible desde otro dispositivo.

### Guion sugerido (≤ 10 min)

| Min | Actor | Acción esperada |
|----:|--------|-----------------|
| 0–1 | Visitante | Catálogo público sin login |
| 1–3 | Arrendador | Login → propiedades / solicitud pendiente |
| 3–5 | Arrendatario | Filtros → solicitud / contrato / PDF |
| 5–7 | Arrendatario + Arrendador | Queja → estado RESUELTO |
| 7–9 | Municipio | Listados + estadísticas + (opcional) inhabilitar |
| 9–10 | Cierre | Terminar contrato → DISPONIBLE / mostrar tests en terminal |

### Evidencia de calidad a mencionar

- Suite Vitest + E2E KAN-60.  
- Suite de seguridad KAN-61.  
- Arquitectura y DER en `/docs`.  
- `database/BDD.sql` como entregable de BD.

## 4. Fallos frecuentes en demo

| Síntoma | Causa probable | Qué hacer |
|---------|----------------|-----------|
| Catálogo vacío | Propiedad sin `approved=true` | Aprobar en panel municipio |
| No puedo publicar | Identidad no verificada | Subir cédula/pasaporte y que municipio verifique |
| 403 en filtros | Sesión no es ARRENDATARIO | Entrar con rol correcto |
| Login municipio falla | Usuario no existe | Ejecutar seed / `database/BDD.sql` |
