# Modelo de datos (DER / Modelo Relacional) — Manta360

Script oficial de creación + seed: [`database/BDD.sql`](../database/BDD.sql).  
Esquema de bootstrap de aplicación (sin seed): [`database/schema.sql`](../database/schema.sql).

El diagrama y el script cubren **todas** las tablas del sistema (núcleo académico + soporte operativo).

## Inventario completo de tablas

| # | Tabla | Propósito |
|---|--------|-----------|
| 1 | `users` | Usuarios y roles (`Role` enum) |
| 2 | `properties` | Inmuebles del arrendador |
| 3 | `service_catalog` | Catálogo de servicios (agua, luz, internet…) |
| 4 | `amenity_catalog` | Catálogo de comodidades |
| 5 | `property_services` | N:M propiedad ↔ servicio |
| 6 | `property_amenities` | N:M propiedad ↔ comodidad |
| 7 | `property_images` | Fotos de la propiedad (Storage) |
| 8 | `contract_requests` | Solicitudes de arriendo |
| 9 | `contracts` | Contratos y ciclo de vida |
| 10 | `contract_renewal_requests` | Renovaciones |
| 11 | `incident_reports` | Quejas / mantenimiento |
| 12 | `identity_documents` | Documentos de identidad |
| 13 | `identity_document_reviews` | Historial de revisión municipal |
| 14 | `chat_messages` | Mensajería por propiedad |

Enums: `Role`, `PropertyStatus`, `ContractStatus`, `RequestStatus`, `IncidentStatus`, `IdentityDocumentType`, `IdentityDocumentStatus`.

## Diagrama entidad-relación completo (Mermaid)

```mermaid
erDiagram
  users ||--o{ properties : "landlordId / createdBy"
  users ||--o{ contract_requests : "tenantId"
  users ||--o{ contracts : "tenantId"
  users ||--o{ contracts : "landlordId"
  users ||--o{ incident_reports : "tenantId"
  users ||--o{ incident_reports : "landlordId"
  users ||--o{ identity_documents : "userId"
  users ||--o{ identity_documents : "uploadedBy"
  users ||--o{ identity_documents : "reviewedBy"
  users ||--o{ identity_document_reviews : "reviewerId"
  users ||--o{ chat_messages : "senderId"
  users ||--o{ chat_messages : "recipientId"
  users ||--o{ contract_renewal_requests : "requestedBy"

  properties ||--o{ property_images : "propertyId"
  properties ||--o{ property_services : "propertyId"
  properties ||--o{ property_amenities : "propertyId"
  properties ||--o{ contract_requests : "propertyId"
  properties ||--o{ contracts : "propertyId"
  properties ||--o{ incident_reports : "propertyId"
  properties ||--o{ chat_messages : "propertyId"

  service_catalog ||--o{ property_services : "serviceId"
  amenity_catalog ||--o{ property_amenities : "amenityId"

  contracts ||--o{ incident_reports : "contractId"
  contracts ||--o{ contract_renewal_requests : "contractId"

  identity_documents ||--o{ identity_document_reviews : "identityDocumentId"

  users {
    text id PK
    text email UK
    text passwordHash
    text fullName
    text phone
    text nationalId UK
    Role role
    boolean active
    timestamp disabledAt
    text disabledBy
    text disableReason
    timestamp createdAt
    timestamp updatedAt
  }

  properties {
    text id PK
    text landlordId FK
    text title
    text address
    decimal monthlyRent
    PropertyStatus status
    text description
    int bedrooms
    int bathrooms
    decimal latitude
    decimal longitude
    text createdBy FK
    boolean approved
    timestamp approvedAt
    text approvedBy
    timestamp disabledAt
    text disabledBy
    text disableReason
    timestamp createdAt
    timestamp updatedAt
  }

  service_catalog {
    uuid id PK
    text name UK
    varchar slug UK
    boolean active
    timestamp createdAt
    timestamp updatedAt
  }

  amenity_catalog {
    uuid id PK
    text name UK
    varchar slug UK
    boolean active
    timestamp createdAt
    timestamp updatedAt
  }

  property_services {
    text propertyId PK_FK
    uuid serviceId PK_FK
    timestamp createdAt
  }

  property_amenities {
    text propertyId PK_FK
    uuid amenityId PK_FK
    timestamp createdAt
  }

  property_images {
    uuid id PK
    text propertyId FK
    text storagePath UK
    text originalName
    varchar extension
    varchar mimeType
    bigint fileSize
    varchar sha256
    int width
    int height
    boolean isPrimary
    int displayOrder
    timestamp createdAt
    timestamp updatedAt
  }

  contract_requests {
    text id PK
    text propertyId FK
    text tenantId FK
    RequestStatus status
    text message
    timestamp startDate
    timestamp endDate
    timestamp createdAt
    timestamp updatedAt
  }

  contracts {
    text id PK
    text propertyId FK
    text tenantId FK
    text landlordId FK
    timestamp startDate
    timestamp endDate
    ContractStatus status
    decimal monthlyRent
    text city
    text province
    text canton
    text parish
    text neighborhood
    text street
    text houseNumber
    text intersection
    text purpose
    decimal depositAmount
    text paymentMethod
    timestamp landlordSignedAt
    timestamp tenantSignedAt
    timestamp municipalReviewedAt
    text municipalReviewedBy
    text municipalReviewNotes
    timestamp endedAt
    text endedBy
    timestamp createdAt
    timestamp updatedAt
  }

  contract_renewal_requests {
    text id PK
    text contractId FK
    text requestedBy FK
    timestamp proposedEndDate
    RequestStatus status
    timestamp createdAt
    timestamp updatedAt
  }

  incident_reports {
    text id PK
    text contractId FK
    text propertyId FK
    text tenantId FK
    text landlordId FK
    text description
    timestamp incidentDate
    IncidentStatus status
    timestamp createdAt
    timestamp updatedAt
  }

  identity_documents {
    uuid id PK
    text userId FK
    text uploadedBy FK
    IdentityDocumentType documentType
    varchar side
    text storagePath UK
    text originalName
    varchar extension
    varchar mimeType
    bigint fileSize
    varchar sha256
    IdentityDocumentStatus verificationStatus
    timestamp uploadedAt
    timestamp reviewedAt
    text reviewedBy FK
    text reviewNotes
    timestamp expiresAt
    boolean isCurrent
    timestamp createdAt
    timestamp updatedAt
  }

  identity_document_reviews {
    uuid id PK
    uuid identityDocumentId FK
    text reviewerId FK
    IdentityDocumentStatus previousStatus
    IdentityDocumentStatus newStatus
    text notes
    timestamp createdAt
  }

  chat_messages {
    text id PK
    text propertyId FK
    text senderId FK
    text recipientId FK
    text content
    timestamp createdAt
    timestamp readAt
  }
```

## Estados clave

**Propiedad (`PropertyStatus`):** `DISPONIBLE` · `OCUPADO` · `MANTENIMIENTO` · `INHABILITADO`

**Contrato (`ContractStatus`):** `PENDIENTE_FIRMA` · `PENDIENTE_MUNICIPIO` · `ACTIVO` · `EN_RENOVACION` · `FINALIZADO` · `RECHAZADO_MUNICIPIO`

**Queja (`IncidentStatus`):** `PENDIENTE` · `EN_PROCESO` · `RESUELTO`

**Solicitud / renovación (`RequestStatus`):** `PENDIENTE` · `APROBADO` · `RECHAZADO`

## Integridad relevante

- Un solo contrato efectivo (`ACTIVO` / `EN_RENOVACION`) por propiedad (índice único parcial).
- Catálogo público: `status = DISPONIBLE` ∧ `approved = true` ∧ arrendador `active`.
- Inhabilitación municipal: propiedad fuera de búsquedas; contratos existentes pueden seguir vigentes.
- `endDate > startDate` en contratos y solicitudes con fechas.
