# Contrato funcional congelado de Chat

| Acción | Prisma anterior | Endpoint | Auth y autorización | Resultado conservado |
| --- | --- | --- | --- | --- |
| Listar conversaciones | `chat_messages.findMany`, `properties.findMany`, `user.findMany` | `GET /api/chat` | Sesión activa obligatoria; solo mensajes con `senderId` o `recipientId` igual a `session.sub` | `401` sin sesión; `200` con `{ currentUserId, messages }`, máximo 500, orden ascendente por `createdAt` |
| Iniciar conversación | `properties.findUnique`, `chat_messages.create` | `POST /api/chat` | Solo `ARRENDATARIO`, destinatario igual a `property.landlordId`, propiedad `DISPONIBLE` | `201` con `{ message }`; payload fijo `{ propertyId, recipientId, content }` |
| Responder conversación | `properties.findUnique`, `chat_messages.findFirst`, `chat_messages.create` | `POST /api/chat` | Solo `ARRENDADOR` dueño de la propiedad y con conversación existente entre los dos participantes | `201` con `{ message }` |
| Rechazar acceso indebido | Operaciones anteriores condicionadas en route | `POST /api/chat` | Municipio, emisor externo, destinatario que no es el dueño, mensaje propio o propiedad no disponible | `401`, `403`, `400` o `409` según la regla existente |

## Payload y respuesta

`POST /api/chat` recibe exclusivamente JSON con `propertyId` (string no vacío), `recipientId` (string no vacío) y `content` (string trim, 1 a 2000 caracteres). No hay campos añadidos, renombrados ni eliminados.

El mensaje creado conserva `id`, `propertyId`, `senderId`, `recipientId`, `content`, `createdAt` y `readAt`. El listado añade únicamente el detalle ya existente: `property` opcional (`id`, `title`, `landlordId`), `senderName` y `recipientName` con respaldo `Usuario`.

## Límites de seguridad

- La autorización permanece en el servidor y no depende de RLS.
- `recipientId` no permite suplantar al remitente: `senderId` siempre se toma de la sesión.
- El listado filtra en SQL por participación del usuario autenticado.
- El municipio no puede enviar mensajes; el comportamiento GET se conserva sin abrir conversaciones ajenas.
