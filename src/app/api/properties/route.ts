import { NextResponse } from "next/server";
import { Prisma, PropertyStatus } from "@prisma/client";
import { getActiveSession } from "@/lib/server-auth";
import { createTextId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { serializeCatalogProperty } from "@/lib/property-catalog-pg";
import { propertiesRepository } from "@/repositories/properties.server";
import { validateUpload, UploadValidationError } from "@/lib/file-validation";
import {
  PROPERTY_IMAGES_BUCKET,
  createStorageSignedUrl,
  propertyImagePath,
  removeStorageFile,
  uploadStorageFile,
} from "@/lib/supabase/storage";
import {
  propertyCatalogSlug,
  propertyInputSchema,
  uniquePropertyLabels,
} from "@/lib/property-validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function formStringArray(formData: FormData, name: string): string[] | null {
  const raw = formString(formData, name);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
  } catch {
    return null;
  }
}

type PropertyWithRelations = Prisma.propertiesGetPayload<{ include: ReturnType<typeof findPropertyInclude> }>;

async function serializeProperty(property: PropertyWithRelations) {
  const images = await Promise.all(
    property.property_images.map(async (image) => ({
      id: image.id,
      url: await createStorageSignedUrl(PROPERTY_IMAGES_BUCKET, image.storagePath),
      isPrimary: image.isPrimary,
      displayOrder: image.displayOrder,
    })),
  );
  const usableImages = images.filter((image) => image.url);

  return {
    id: property.id,
    title: property.title,
    address: property.address,
    monthlyRent: Number(property.monthlyRent),
    status: property.status,
    description: property.description,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    latitude: property.latitude === null ? null : Number(property.latitude),
    longitude: property.longitude === null ? null : Number(property.longitude),
    landlord: {
      id: property.users_properties_landlordIdTousers.id,
      fullName: property.users_properties_landlordIdTousers.fullName,
    },
    services: property.property_services.map(({ service_catalog }) => service_catalog.name),
    amenities: property.property_amenities.map(({ amenity_catalog }) => amenity_catalog.name),
    images: usableImages,
    image: usableImages.find((image) => image.isPrimary)?.url ?? usableImages[0]?.url ?? null,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  };
}

function findPropertyInclude() {
  return {
    users_properties_landlordIdTousers: { select: { id: true, fullName: true } },
    property_images: { orderBy: [{ isPrimary: "desc" as const }, { displayOrder: "asc" as const }, { createdAt: "asc" as const }] },
    property_services: { include: { service_catalog: { select: { name: true } } }, orderBy: { createdAt: "asc" as const } },
    property_amenities: { include: { amenity_catalog: { select: { name: true } } }, orderBy: { createdAt: "asc" as const } },
  };
}

async function findProperty(id: string) {
  const property = await prisma.properties.findUnique({ where: { id }, include: findPropertyInclude() });
  if (!property) throw new Error("Propiedad no encontrada");
  return property;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const minPriceParam = url.searchParams.get("minPrice");
  const maxPriceParam = url.searchParams.get("maxPrice");
  const minPrice = minPriceParam === null ? null : Number(minPriceParam);
  const maxPrice = maxPriceParam === null ? null : Number(maxPriceParam);
  const services = (url.searchParams.get("services") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  // El catálogo público mantiene la propiedad visible durante conversaciones y
  // solicitudes; solo se retira cuando el contrato queda formalizado.
  const filters = {
    minPrice: minPrice !== null && Number.isFinite(minPrice) && minPrice >= 0 ? minPrice : null,
    maxPrice: maxPrice !== null && Number.isFinite(maxPrice) && maxPrice >= 0 ? maxPrice : null,
    services,
  };

  try {
    const properties = await propertiesRepository.listCatalogProperties(filters);
    return NextResponse.json(
      { properties: await Promise.all(properties.map(serializeCatalogProperty)) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("properties list error", error);
    return NextResponse.json({ error: "No se pudo cargar el catálogo" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (session.role !== "ARRENDADOR") return NextResponse.json({ error: "Solo un arrendador puede publicar propiedades" }, { status: 403 });

  const identityDocuments = await prisma.identity_documents.findMany({ where: { userId: session.sub, isCurrent: true, verificationStatus: "VERIFICADO" }, select: { documentType: true, side: true } });
  const verifiedSides = new Set(identityDocuments.filter((document) => document.documentType === "CEDULA").map((document) => document.side));
  const canPublish = identityDocuments.some((document) => document.documentType === "PASAPORTE") || (verifiedSides.has("FRENTE") && verifiedSides.has("REVERSO"));
  if (!canPublish) return NextResponse.json({ error: "Debes tener verificados ambos lados de tu cedula o un pasaporte antes de publicar una propiedad" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario multipart inválido" }, { status: 400 });
  }

  const services = formStringArray(formData, "services");
  const amenities = formStringArray(formData, "amenities");
  if (!services || !amenities) return NextResponse.json({ error: "Servicios o comodidades inválidos" }, { status: 400 });

  const parsed = propertyInputSchema.safeParse({
    title: formString(formData, "title"),
    address: formString(formData, "address"),
    monthlyRent: formString(formData, "monthlyRent") || formString(formData, "price"),
    bedrooms: formString(formData, "bedrooms"),
    bathrooms: formString(formData, "bathrooms"),
    description: formString(formData, "description"),
    latitude: formString(formData, "latitude"),
    longitude: formString(formData, "longitude"),
    services: uniquePropertyLabels(services),
    amenities: uniquePropertyLabels(amenities),
  });
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    return NextResponse.json({ error: `Revisa los campos obligatorios: ${Object.keys(details).join(", ")}`, details }, { status: 400 });
  }

  const files = formData.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length < 3) return NextResponse.json({ error: "Debes cargar al menos 3 imágenes" }, { status: 400 });
  if (files.length > 12) return NextResponse.json({ error: "Puedes cargar como máximo 12 imágenes" }, { status: 400 });

  let propertyId = "";
  const uploadedPaths: string[] = [];
  try {
    const data = parsed.data;
    propertyId = createTextId();
    await prisma.$transaction(async (tx) => {
      const serviceEntries = await Promise.all(data.services.map((name) => tx.service_catalog.upsert({
        where: { name },
        create: { name, slug: `${propertyCatalogSlug(name)}-${Date.now().toString(36)}`.slice(0, 120) },
        update: { active: true },
      })));
      const amenityEntries = await Promise.all(data.amenities.map((name) => tx.amenity_catalog.upsert({
        where: { name },
        create: { name, slug: `${propertyCatalogSlug(name)}-${Date.now().toString(36)}`.slice(0, 120) },
        update: { active: true },
      })));

      await tx.properties.create({
        data: {
          id: propertyId,
          landlordId: session.sub,
          createdBy: session.sub,
          updatedAt: new Date(),
          title: data.title,
          address: data.address,
          monthlyRent: new Prisma.Decimal(data.monthlyRent),
          description: data.description,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
          latitude: new Prisma.Decimal(data.latitude),
          longitude: new Prisma.Decimal(data.longitude),
          status: PropertyStatus.DISPONIBLE,
          ...(serviceEntries.length > 0 ? { property_services: { create: serviceEntries.map(({ id }) => ({ serviceId: id })) } } : {}),
          ...(amenityEntries.length > 0 ? { property_amenities: { create: amenityEntries.map(({ id }) => ({ amenityId: id })) } } : {}),
        },
      });
    });

    const hashes = new Set<string>();
    for (const [index, file] of files.entries()) {
      const upload = await validateUpload(file, "property-image");
      if (hashes.has(upload.sha256)) throw new UploadValidationError("No puedes cargar la misma imagen más de una vez");
      hashes.add(upload.sha256);
      const storagePath = propertyImagePath(propertyId, upload.extension);
      await uploadStorageFile(PROPERTY_IMAGES_BUCKET, storagePath, upload);
      uploadedPaths.push(storagePath);
      await prisma.property_images.create({
        data: {
          propertyId,
          storagePath,
          originalName: upload.originalName,
          extension: upload.extension,
          mimeType: upload.mimeType,
          fileSize: BigInt(upload.fileSize),
          sha256: upload.sha256,
          isPrimary: index === 0,
          displayOrder: index,
        },
      });
    }

    const property = await findProperty(propertyId);
    return NextResponse.json({ property: await serializeProperty(property) }, { status: 201 });
  } catch (error) {
    await Promise.all(uploadedPaths.map((path) => removeStorageFile(PROPERTY_IMAGES_BUCKET, path).catch((cleanupError) => console.error("property image cleanup error", cleanupError))));
    if (propertyId) await prisma.properties.delete({ where: { id: propertyId } }).catch((cleanupError) => console.error("property cleanup error", cleanupError));
    if (error instanceof UploadValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("property create error", error);
    return NextResponse.json({ error: "No se pudo publicar la propiedad" }, { status: 500 });
  }
}
