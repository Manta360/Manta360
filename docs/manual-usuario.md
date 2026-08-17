# Manual de usuario por rol — Manta360

Guía orientada a la demostración en vivo y a la rúbrica académica. Los seis módulos del enunciado oficial se cubren a continuación.

## Módulos del sistema

1. Registro de usuarios y autenticación  
2. Registro y gestión de propiedades  
3. Gestión de contratos e inquilinos  
4. Reportes, quejas y mantenimiento  
5. Búsqueda inteligente y disponibilidad  
6. Panel del municipio y estadísticas  

---

## Visitante (sin cuenta)

**Qué puede hacer**

- Ver el catálogo público de propiedades **disponibles y aprobadas** en la landing (`/`).
- Explorar listado y mapa sin iniciar sesión.

**Qué no puede hacer**

- Usar filtros avanzados (ubicación, precio, servicios) → requiere rol arrendatario.
- Solicitar contratos, reportar quejas o entrar a paneles.

**Cómo probarlo:** abrir la URL pública (o `http://localhost:3000`) sin cookie de sesión y revisar la sección de catálogo.

---

## Arrendatario

**Acceso:** registrarse en `/registro` eligiendo *Arrendatario*, o usar el usuario demo `arrendatario@manta360.demo` / `Demo1234!`.

| Acción | Dónde |
|--------|--------|
| Explorar y filtrar (ubicación, precio, servicios) | `/panel/arrendatario/explorar` |
| Solicitar contrato | Desde la ficha / flujo de solicitud |
| Ver contratos activos e históricos | `/panel/arrendatario/contratos` |
| Firmar, descargar PDF, terminar, renovar (≤ 15 días) | Detalle `/contratos/[id]` |
| Reportar queja (solo contrato **ACTIVO**) | `/panel/arrendatario/incidencias` |
| Mensajes / documentos de identidad | Menú del panel |

---

## Arrendador

**Acceso:** `/registro` como *Arrendador*, o demo `arrendador@manta360.demo` / `Demo1234!`.

| Acción | Dónde |
|--------|--------|
| Validar identidad (requisito para publicar) | Documentos del panel |
| Publicar propiedad (dirección, precio, servicios, ≥ 3 fotos) | `/panel/arrendador/propiedades` |
| Editar, mantenimiento ↔ disponible, eliminar (sin historial bloqueante) | Misma sección |
| Aceptar / rechazar solicitudes | `/panel/arrendador/solicitudes` |
| Preparar/firmar contrato, terminar, aprobar renovaciones | Contratos / renovaciones |
| Gestionar quejas (pendiente → en proceso → resuelto) | `/panel/arrendador/incidencias` |

**Nota:** el estado **OCUPADO** lo fija el sistema al activar un contrato; no se elige a mano.

---

## Municipio

**No se registra por UI.** Se crea en base de datos:

```powershell
$env:MUNICIPIO_EMAIL="admin@tu-dominio.ec"
$env:MUNICIPIO_PASSWORD="una-contrasena-fuerte"
npm run db:seed-municipio
```

O con el seed de `database/BDD.sql`: `municipio@manta360.demo` / `Demo1234!`.

| Acción | Dónde |
|--------|--------|
| Revisar propiedades pendientes / aprobar | `/panel/municipio/propiedades` |
| Revisar contratos pendientes municipales | `/panel/municipio/contratos` |
| Ver quejas de todo el sistema | `/panel/municipio/incidencias` |
| Estadísticas (zonas, precios, quejas, top arrendadores) | `/panel/municipio/estadisticas` |
| Inhabilitar arrendador o propiedad | Usuarios / propiedades |
| Revisar documentos de identidad | `/panel/municipio/documentos` |

Al inhabilitar: la propiedad sale del catálogo y no admite contratos nuevos; los contratos existentes pueden seguir vigentes.

---

## Flujo recomendado de demo (happy path)

1. Visitante ve propiedades disponibles.  
2. Arrendador publica (o usa la propiedad del seed) → Municipio aprueba.  
3. Arrendatario filtra, solicita → Arrendador acepta.  
4. Firmas → Municipio activa contrato → propiedad **OCUPADO**.  
5. Arrendatario crea queja → Arrendador la deja **RESUELTO**.  
6. Municipio verifica listados.  
7. Terminar contrato → propiedad vuelve a **DISPONIBLE**.

Detalle automatizado: [pruebas-y-demo.md](./pruebas-y-demo.md).
