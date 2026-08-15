import { Prisma } from "@prisma/client";
import { createStorageSignedUrl, PROPERTY_IMAGES_BUCKET } from "@/lib/supabase/storage";

export const ownedPropertyInclude = Prisma.validator<Prisma.propertiesInclude>()({
  property_images: {
    orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
  },
  property_services: {
    include: { service_catalog: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  },
  property_amenities: {
    include: { amenity_catalog: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  },
});

type OwnedProperty = Prisma.propertiesGetPayload<{ include: typeof ownedPropertyInclude }>;

export async function serializeOwnedProperty(property: OwnedProperty) {
  const images = (await Promise.all(property.property_images.map(async (image) => ({
    id: image.id,
    url: await createStorageSignedUrl(PROPERTY_IMAGES_BUCKET, image.storagePath),
    isPrimary: image.isPrimary,
    displayOrder: image.displayOrder,
  })))).filter((image) => image.url);

  return {
    id: property.id,
    title: property.title,
    address: property.address,
    monthlyRent: Number(property.monthlyRent),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    description: property.description,
    latitude: property.latitude === null ? null : Number(property.latitude),
    longitude: property.longitude === null ? null : Number(property.longitude),
    status: property.status,
    approved: property.approved,
    disableReason: property.disableReason,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
    services: property.property_services.map(({ service_catalog }) => service_catalog.name),
    amenities: property.property_amenities.map(({ amenity_catalog }) => amenity_catalog.name),
    images,
    image: images.find((image) => image.isPrimary)?.url ?? images[0]?.url ?? null,
  };
}
