-- Canonical PostgreSQL bootstrap for an empty Manta360 database.
-- This file is intentionally self-contained and does not create migration metadata.

BEGIN;

DO $$
BEGIN
  CREATE TYPE "Role" AS ENUM ('ARRENDADOR', 'ARRENDATARIO', 'MUNICIPIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ContractStatus" AS ENUM ('PENDIENTE_FIRMA', 'PENDIENTE_MUNICIPIO', 'ACTIVO', 'RECHAZADO_MUNICIPIO', 'FINALIZADO', 'EN_RENOVACION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "IdentityDocumentStatus" AS ENUM ('PENDIENTE', 'EN_REVISION', 'VERIFICADO', 'RECHAZADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "IdentityDocumentType" AS ENUM ('CEDULA', 'PASAPORTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "IncidentStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'RESUELTO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PropertyStatus" AS ENUM ('DISPONIBLE', 'OCUPADO', 'MANTENIMIENTO', 'INHABILITADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "RequestStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT NOT NULL,
  email TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  phone TEXT,
  "nationalId" TEXT,
  role "Role" NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  "disabledAt" TIMESTAMP(3),
  "disabledBy" TEXT,
  "disableReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_nationalId_key UNIQUE ("nationalId")
);

CREATE TABLE IF NOT EXISTS public.properties (
  id TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  title TEXT NOT NULL,
  address TEXT NOT NULL,
  "monthlyRent" DECIMAL(10, 2) NOT NULL,
  status "PropertyStatus" NOT NULL DEFAULT 'DISPONIBLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  description TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  "createdBy" TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "disabledAt" TIMESTAMP(3),
  "disabledBy" TEXT,
  "disableReason" TEXT,
  CONSTRAINT properties_pkey PRIMARY KEY (id),
  CONSTRAINT properties_landlordId_fkey FOREIGN KEY ("landlordId") REFERENCES public.users(id),
  CONSTRAINT properties_createdby_fkey FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.service_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT service_catalog_pkey PRIMARY KEY (id),
  CONSTRAINT service_catalog_name_unique UNIQUE (name),
  CONSTRAINT service_catalog_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.amenity_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT amenity_catalog_pkey PRIMARY KEY (id),
  CONSTRAINT amenity_catalog_name_unique UNIQUE (name),
  CONSTRAINT amenity_catalog_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.property_services (
  "propertyId" TEXT NOT NULL,
  "serviceId" UUID NOT NULL,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT property_services_pkey PRIMARY KEY ("propertyId", "serviceId"),
  CONSTRAINT property_services_property_fkey FOREIGN KEY ("propertyId") REFERENCES public.properties(id) ON DELETE CASCADE,
  CONSTRAINT property_services_service_fkey FOREIGN KEY ("serviceId") REFERENCES public.service_catalog(id)
);

CREATE TABLE IF NOT EXISTS public.property_amenities (
  "propertyId" TEXT NOT NULL,
  "amenityId" UUID NOT NULL,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT property_amenities_pkey PRIMARY KEY ("propertyId", "amenityId"),
  CONSTRAINT property_amenities_property_fkey FOREIGN KEY ("propertyId") REFERENCES public.properties(id) ON DELETE CASCADE,
  CONSTRAINT property_amenities_amenity_fkey FOREIGN KEY ("amenityId") REFERENCES public.amenity_catalog(id)
);

CREATE TABLE IF NOT EXISTS public.property_images (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  "propertyId" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  extension VARCHAR(10) NOT NULL,
  "mimeType" VARCHAR(80) NOT NULL,
  "fileSize" BIGINT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  width INTEGER,
  height INTEGER,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT property_images_pkey PRIMARY KEY (id),
  CONSTRAINT property_images_storage_path_unique UNIQUE ("storagePath"),
  CONSTRAINT property_images_property_sha256_idx UNIQUE ("propertyId", sha256),
  CONSTRAINT property_images_property_fkey FOREIGN KEY ("propertyId") REFERENCES public.properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.contract_requests (
  id TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  status "RequestStatus" NOT NULL DEFAULT 'PENDIENTE',
  message TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT contract_requests_pkey PRIMARY KEY (id),
  CONSTRAINT contract_requests_propertyId_fkey FOREIGN KEY ("propertyId") REFERENCES public.properties(id) ON DELETE CASCADE,
  CONSTRAINT contract_requests_tenantId_fkey FOREIGN KEY ("tenantId") REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT contract_requests_end_date_after_start_date CHECK (
    "startDate" IS NULL OR "endDate" IS NULL OR "endDate" > "startDate"
  )
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  status "ContractStatus" NOT NULL DEFAULT 'ACTIVO',
  "monthlyRent" DECIMAL(10, 2),
  city TEXT,
  province TEXT,
  canton TEXT,
  parish TEXT,
  neighborhood TEXT,
  street TEXT,
  "houseNumber" TEXT,
  intersection TEXT,
  purpose TEXT,
  "depositAmount" DECIMAL(10, 2),
  "paymentMethod" TEXT,
  "landlordSignedAt" TIMESTAMP(3),
  "tenantSignedAt" TIMESTAMP(3),
  "municipalReviewedAt" TIMESTAMP(3),
  "municipalReviewedBy" TEXT,
  "municipalReviewNotes" TEXT,
  "endedAt" TIMESTAMP(3),
  "endedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT contracts_pkey PRIMARY KEY (id),
  CONSTRAINT contracts_propertyId_fkey FOREIGN KEY ("propertyId") REFERENCES public.properties(id),
  CONSTRAINT contracts_tenantId_fkey FOREIGN KEY ("tenantId") REFERENCES public.users(id),
  CONSTRAINT contracts_landlordId_fkey FOREIGN KEY ("landlordId") REFERENCES public.users(id),
  CONSTRAINT contracts_end_date_after_start_date CHECK ("endDate" > "startDate")
);

CREATE TABLE IF NOT EXISTS public.contract_renewal_requests (
  id TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "proposedEndDate" TIMESTAMP(3) NOT NULL,
  status "RequestStatus" NOT NULL DEFAULT 'PENDIENTE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT contract_renewal_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.incident_reports (
  id TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  description TEXT NOT NULL,
  "incidentDate" TIMESTAMP(3) NOT NULL,
  status "IncidentStatus" NOT NULL DEFAULT 'PENDIENTE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT incident_reports_pkey PRIMARY KEY (id),
  CONSTRAINT incident_reports_contractId_fkey FOREIGN KEY ("contractId") REFERENCES public.contracts(id) ON DELETE CASCADE,
  CONSTRAINT incident_reports_propertyId_fkey FOREIGN KEY ("propertyId") REFERENCES public.properties(id) ON DELETE CASCADE,
  CONSTRAINT incident_reports_tenantId_fkey FOREIGN KEY ("tenantId") REFERENCES public.users(id),
  CONSTRAINT incident_reports_landlordId_fkey FOREIGN KEY ("landlordId") REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.identity_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "documentType" "IdentityDocumentType" NOT NULL,
  side VARCHAR(12) NOT NULL DEFAULT 'UNICA',
  "storagePath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  extension VARCHAR(10) NOT NULL,
  "mimeType" VARCHAR(80) NOT NULL,
  "fileSize" BIGINT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  "verificationStatus" "IdentityDocumentStatus" NOT NULL DEFAULT 'PENDIENTE',
  "uploadedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(6),
  "reviewedBy" TEXT,
  "reviewNotes" TEXT,
  "expiresAt" TIMESTAMP(6),
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT identity_documents_pkey PRIMARY KEY (id),
  CONSTRAINT identity_documents_storage_path_unique UNIQUE ("storagePath"),
  CONSTRAINT identity_documents_user_fkey FOREIGN KEY ("userId") REFERENCES public.users(id),
  CONSTRAINT identity_documents_uploaded_by_fkey FOREIGN KEY ("uploadedBy") REFERENCES public.users(id),
  CONSTRAINT identity_documents_reviewer_fkey FOREIGN KEY ("reviewedBy") REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.identity_document_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  "identityDocumentId" UUID NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "previousStatus" "IdentityDocumentStatus" NOT NULL,
  "newStatus" "IdentityDocumentStatus" NOT NULL,
  notes TEXT,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT identity_document_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT identity_document_reviews_document_fkey FOREIGN KEY ("identityDocumentId") REFERENCES public.identity_documents(id),
  CONSTRAINT identity_document_reviews_reviewer_fkey FOREIGN KEY ("reviewerId") REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  content TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);
CREATE INDEX IF NOT EXISTS properties_landlordId_idx ON public.properties ("landlordId");
CREATE INDEX IF NOT EXISTS properties_status_idx ON public.properties (status);
CREATE INDEX IF NOT EXISTS properties_created_by_created_at_id_idx ON public.properties ("createdBy", "createdAt" DESC, id);
CREATE INDEX IF NOT EXISTS properties_landlord_created_at_id_idx ON public.properties ("landlordId", "createdAt" DESC, id);
CREATE INDEX IF NOT EXISTS properties_status_created_at_id_idx ON public.properties (status, "createdAt" DESC, id);
CREATE INDEX IF NOT EXISTS properties_status_monthly_rent_idx ON public.properties (status, "monthlyRent");
CREATE INDEX IF NOT EXISTS property_services_service_property_idx ON public.property_services ("serviceId", "propertyId");
CREATE INDEX IF NOT EXISTS property_amenities_amenity_property_idx ON public.property_amenities ("amenityId", "propertyId");
CREATE INDEX IF NOT EXISTS property_images_property_order_idx ON public.property_images ("propertyId", "displayOrder", id);
CREATE INDEX IF NOT EXISTS contract_requests_propertyId_status_idx ON public.contract_requests ("propertyId", status);
CREATE INDEX IF NOT EXISTS contract_requests_tenantId_status_idx ON public.contract_requests ("tenantId", status);
CREATE INDEX IF NOT EXISTS contracts_landlordId_status_idx ON public.contracts ("landlordId", status);
CREATE INDEX IF NOT EXISTS contracts_propertyId_status_idx ON public.contracts ("propertyId", status);
CREATE INDEX IF NOT EXISTS contracts_tenantId_status_idx ON public.contracts ("tenantId", status);
CREATE UNIQUE INDEX IF NOT EXISTS contracts_one_effective_contract_per_property
  ON public.contracts ("propertyId")
  WHERE status IN ('ACTIVO', 'EN_RENOVACION');
CREATE INDEX IF NOT EXISTS contracts_status_end_date_idx ON public.contracts (status, "endDate");
CREATE INDEX IF NOT EXISTS contract_renewal_requests_contractId_status_idx ON public.contract_renewal_requests ("contractId", status);
CREATE INDEX IF NOT EXISTS contract_renewal_requests_requestedBy_status_idx ON public.contract_renewal_requests ("requestedBy", status);
CREATE INDEX IF NOT EXISTS incident_reports_contractId_status_idx ON public.incident_reports ("contractId", status);
CREATE INDEX IF NOT EXISTS incident_reports_tenantId_status_idx ON public.incident_reports ("tenantId", status);
CREATE INDEX IF NOT EXISTS incident_reports_landlordId_status_idx ON public.incident_reports ("landlordId", status);
CREATE INDEX IF NOT EXISTS identity_documents_status_uploaded_idx ON public.identity_documents ("verificationStatus", "uploadedAt" DESC, id);
CREATE INDEX IF NOT EXISTS identity_documents_uploaded_by_created_idx ON public.identity_documents ("uploadedBy", "createdAt" DESC, id);
CREATE INDEX IF NOT EXISTS identity_documents_user_uploaded_idx ON public.identity_documents ("userId", "uploadedAt" DESC, id);
CREATE UNIQUE INDEX IF NOT EXISTS identity_documents_current_side_unique
  ON public.identity_documents ("userId", "documentType", side)
  WHERE "isCurrent";
CREATE INDEX IF NOT EXISTS identity_document_reviews_document_created_idx ON public.identity_document_reviews ("identityDocumentId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS identity_document_reviews_reviewer_created_idx ON public.identity_document_reviews ("reviewerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS chat_messages_propertyId_createdAt_idx ON public.chat_messages ("propertyId", "createdAt");
CREATE INDEX IF NOT EXISTS chat_messages_senderId_recipientId_createdAt_idx ON public.chat_messages ("senderId", "recipientId", "createdAt");

COMMIT;
