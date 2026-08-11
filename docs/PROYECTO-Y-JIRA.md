# Manta360 — Resumen del Proyecto y Trazabilidad con Jira

## 1. Propósito

Manta360 es una plataforma web para gestionar arriendos en Manta, Ecuador. Conecta a arrendadores, arrendatarios y al Municipio en un solo flujo: verificación de identidad, publicación de propiedades, comunicación privada, contratos y control municipal.

## 2. Roles del sistema

| Rol | Responsabilidades principales |
| --- | --- |
| Visitante | Consulta el catálogo público de propiedades aprobadas y disponibles sin iniciar sesión. |
| Arrendatario | Se registra, carga su identificación, conversa con arrendadores, solicita contratos y confirma sus datos. |
| Arrendador | Se registra, carga su identificación, publica propiedades, responde mensajes y acepta o rechaza solicitudes de contrato. |
| Municipio | Valida documentos de identidad, aprueba o retira propiedades y aprueba o rechaza contratos listos para formalización. |

## 3. Funcionalidades implementadas

- Registro con nombre completo, cédula, teléfono, correo y contraseña.
- Inicio de sesión por correo o cédula; contraseñas protegidas con bcrypt.
- Paneles personalizados por rol y protección de rutas mediante middleware.
- Carga de cédula por frente/reverso o pasaporte hacia Supabase Storage.
- Revisión municipal de identidad y distintivo visible **“Documentos validados con éxito”**.
- Publicación de propiedades con imágenes desde el dispositivo, ubicación en mapa y validaciones amigables.
- Catálogo público de propiedades aprobadas que permanece disponible para visitantes.
- Chat privado entre arrendatario y arrendador relacionado con cada propiedad.
- Solicitud de contrato, aceptación/rechazo por el arrendador y confirmación de ambas partes.
- Documento de contrato preparado para impresión o guardado como PDF.
- Revisión final municipal del contrato. Solo su aprobación activa el contrato y cambia la propiedad a `OCUPADO`.
- Base para solicitudes de renovación próximas al vencimiento.

## 4. Flujo de alquiler

1. El arrendador se registra y carga su documento de identidad.
2. El Municipio valida el documento.
3. El arrendador publica una propiedad con fotografías y ubicación.
4. El Municipio aprueba la publicación.
5. La propiedad aparece en el catálogo público mientras está disponible.
6. Un arrendatario validado contacta al dueño mediante el chat.
7. El arrendatario solicita un contrato y el arrendador lo acepta o rechaza.
8. Ambas partes confirman los datos del contrato.
9. El Municipio revisa el contrato. Si lo aprueba, el contrato queda activo y la propiedad pasa a `OCUPADO`.

## 5. Relación con Jira

La integración GitHub–Jira reconoce las claves incluidas en nombres de ramas, commits y Pull Requests. El Pull Request #6 fue asociado a las tareas siguientes.

| Jira | Entregable en Manta360 | Estado de integración |
| --- | --- | --- |
| KAN-10 | Registro, autenticación, roles y protección de paneles. | Implementado previamente; cubierto por pruebas de autenticación. |
| KAN-20 | Épica: Gestión de Contratos e Inquilinos. | Implementada y vinculada al PR #6. |
| KAN-21 | Solicitud de contrato y aceptación/rechazo. | Implementado mediante solicitudes y decisiones del arrendador. |
| KAN-22 | Bloqueo de stock al aprobar contrato. | Implementado con la regla final acordada: se bloquea al aprobar el Municipio el contrato firmado. |
| KAN-23 | Exportación de contrato a PDF básico. | Implementado con vista contractual lista para imprimir/guardar como PDF. |
| KAN-24 | Solicitud de renovación automática (alerta de 15 días). | Incluida la base de solicitud de renovación para contratos cercanos al vencimiento. |

### Evidencia de integración

- Repositorio: `Manta360/Manta360`.
- Rama de trabajo: `feature/KAN-20-gestion-contratos-inquilinos`.
- Pull Request: [#6 — Gestión de contratos e inquilinos](https://github.com/Manta360/Manta360/pull/6).
- El PR fue aprobado y fusionado a `main` el 11 de agosto de 2026.
- En Jira, cada tarea KAN asociada muestra el commit y la solicitud de incorporación de cambios en la sección **Desarrollo**.

## 6. Configuración de entorno

El archivo real `.env` **no se sube a GitHub** porque contiene contraseñas y una clave de servicio de Supabase. El repositorio incluye `.env.example`, que es la plantilla segura que cada integrante debe copiar:

```powershell
Copy-Item .env.example .env
```

Luego debe completar estos valores privados en su propio archivo `.env`:

```env
DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...:5432/postgres"
AUTH_SECRET="clave-larga-y-privada"
SUPABASE_URL="https://TU-PROYECTO.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="clave-secreta-solo-del-servidor"
```

Reglas de seguridad:

- No enviar ni versionar `.env`, `.env.*`, contraseñas, URLs con contraseña ni `SUPABASE_SERVICE_ROLE_KEY`.
- La clave de servicio solo se usa en rutas del servidor; nunca en variables `NEXT_PUBLIC_*`.
- `identity-documents` debe ser un bucket privado; `property-images` puede ser público para el catálogo.
- Si una clave se comparte por error en un chat o captura, debe rotarse en Supabase.

## 7. Arranque para un integrante nuevo

```powershell
git clone https://github.com/Manta360/Manta360.git
cd Manta360
npm install
Copy-Item .env.example .env
# Completar .env con secretos entregados por un responsable del equipo.
npx prisma db push
npm run db:seed-municipio
npm run dev
```

La aplicación estará en `http://localhost:3000`.

Para base de datos local con Docker, ejecutar `docker compose up -d` y usar las cadenas locales indicadas en `.env.example` antes de ejecutar Prisma.

## 8. Validación realizada

| Comando | Resultado |
| --- | --- |
| `npm run lint` | 0 errores; 4 advertencias no bloqueantes relacionadas con optimización de imágenes y dependencias de hooks. |
| `npm test` | 4 pruebas aprobadas. |

## 9. Reglas de colaboración

1. Actualizar `main` antes de comenzar una tarea.
2. Crear una rama con la clave Jira, por ejemplo `feature/KAN-25-descripcion`.
3. Ejecutar `npm run lint` y `npm test` antes de subir cambios.
4. Abrir un Pull Request hacia `main`, incluir las claves Jira y esperar revisión.
5. No usar `--force-reset` contra la base compartida de Supabase.
6. No hacer merge sin la aprobación requerida por el repositorio.

