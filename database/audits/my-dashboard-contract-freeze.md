# Contrato congelado de `GET /api/my-dashboard`

- Método: `GET`.
- Autenticación: `getActiveSession()`; sin sesión responde `401` con `{ error: "Sesion requerida" }`.
- Roles: `ARRENDADOR`, `ARRENDATARIO` y `MUNICIPIO` con sesión activa.
- Usuario inexistente: `404` con `{ error: "Usuario no encontrado" }`.
- Municipio: devuelve el usuario, el rol y `cards: []`.

| Dato del dashboard | Fuente actual Prisma | Regla/filtro | Forma de salida |
| --- | --- | --- | --- |
| Usuario | `user.findUnique` | `id = session.sub`; selecciona `fullName`, `email`, `phone`, `nationalId` | `user` con los cuatro campos; `phone` y `nationalId` pueden ser `null` |
| Propiedades | `properties.count` | Solo `ARRENDADOR`; `landlordId = session.sub` | `{ label: "Mis propiedades", value: number }` |
| Solicitudes | `contract_requests.count` | Solo `ARRENDATARIO`; `tenantId = session.sub` | `{ label: "Mis solicitudes", value: number }` |
| Conversaciones | `chat_messages.count` | Arrendador o Arrendatario; `senderId = session.sub OR recipientId = session.sub` | `{ label: "Mis conversaciones", value: number }` |
| Documentos verificados | `identity_documents.count` | Arrendador o Arrendatario; `userId = session.sub`, `isCurrent = true`, `verificationStatus = VERIFICADO` | `{ label: "Documentos verificados", value: number }` |

## Respuesta congelada

La respuesta exitosa siempre es `{ user, role, cards }`. Los valores de cards son números, incluidos los ceros. No hay request payload, paginación, query parameters ni agregados de contratos. La implementación Prisma no capturaba errores de base explícitamente; la migración debe devolver un error genérico sin filtrar SQL ni credenciales.
