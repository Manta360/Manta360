import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { createTextId } from "@/lib/ids";
import { serializeCatalogProperty } from "@/lib/property-catalog-pg";
import { propertiesRepository, runPropertiesTransaction } from "@/repositories/properties.server";
import { validateUpload, UploadValidationError } from "@/lib/file-validation";
import {
  PROPERTY_IMAGES_BUCKET,
  propertyImagePath,
  removeStorageFile,
  uploadStorageFile,
} from "@/lib/supabase/storage";
import {
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

function parseCatalogPrice(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseCatalogServices(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasAdvancedCatalogFilters(filters: {
  location: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  services: string[];
}) {
  return Boolean(filters.location || filters.minPrice !== null || filters.maxPrice !== null || filters.services.length > 0);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locationRaw = url.searchParams.get("location")?.trim() ?? "";
  const requestedFilters = {
    location: locationRaw.length > 0 ? locationRaw : null,
    minPrice: parseCatalogPrice(url.searchParams.get("minPrice")),
    maxPrice: parseCatalogPrice(url.searchParams.get("maxPrice")),
    services: parseCatalogServices(url.searchParams.get("services")),
  };

  const session = await getActiveSession();
  const canUseAdvancedFilters = session?.role === "ARRENDATARIO";

  // Visitantes (y roles distintos de arrendatario) solo ven el catálogo público básico.
  // Los filtros avanzados requieren sesión de arrendatario.
  if (hasAdvancedCatalogFilters(requestedFilters) && !canUseAdvancedFilters) {
    return NextResponse.json(
      { error: "Los filtros avanzados solo estan disponibles para arrendatarios autenticados" },
      { status: 403 },
    );
  }

  // El catálogo público mantiene la propiedad visible durante conversaciones y
  // solicitudes; solo se retira cuando el contrato queda formalizado.
  const filters = canUseAdvancedFilters
    ? requestedFilters
    : { location: null, minPrice: null, maxPrice: null, services: [] };

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

  const identityDocuments = await propertiesRepository.listVerifiedIdentityDocuments(session.sub);
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
    await runPropertiesTransaction(async (repository) => {
      const serviceIds = await repository.upsertCatalogEntries(data.services, "service");
      const amenityIds = await repository.upsertCatalogEntries(data.amenities, "amenity");
      await repository.createProperty({
        id: propertyId, landlordId: session.sub, title: data.title, address: data.address,
        monthlyRent: data.monthlyRent, description: data.description, bedrooms: data.bedrooms,
        bathrooms: data.bathrooms, latitude: data.latitude, longitude: data.longitude,
      }, serviceIds, amenityIds);
    });

    const hashes = new Set<string>();
    for (const [index, file] of files.entries()) {
      const upload = await validateUpload(file, "property-image");
      if (hashes.has(upload.sha256)) throw new UploadValidationError("No puedes cargar la misma imagen más de una vez");
      hashes.add(upload.sha256);
      const storagePath = propertyImagePath(propertyId, upload.extension);
      await uploadStorageFile(PROPERTY_IMAGES_BUCKET, storagePath, upload);
      uploadedPaths.push(storagePath);
      await propertiesRepository.createImage({
        propertyId, storagePath, originalName: upload.originalName, extension: upload.extension,
        mimeType: upload.mimeType, fileSize: upload.fileSize, sha256: upload.sha256,
        isPrimary: index === 0, displayOrder: index,
      });
    }

    const property = await propertiesRepository.findForResponse(propertyId);
    if (!property) throw new Error("Propiedad no encontrada");
    return NextResponse.json({ property: await serializeCatalogProperty(property) }, { status: 201 });
  } catch (error) {
    await Promise.all(uploadedPaths.map((path) => removeStorageFile(PROPERTY_IMAGES_BUCKET, path).catch((cleanupError) => console.error("property image cleanup error", cleanupError))));
    if (propertyId) await runPropertiesTransaction((repository) => repository.deleteProperty(propertyId)).catch((cleanupError) => console.error("property cleanup error", cleanupError));
    if (error instanceof UploadValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("property create error", error);
    return NextResponse.json({ error: "No se pudo publicar la propiedad" }, { status: 500 });
  }
}
