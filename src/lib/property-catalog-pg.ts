import { createStorageSignedUrl, PROPERTY_IMAGES_BUCKET } from "@/lib/supabase/storage";
import type { CatalogProperty } from "@/repositories/properties.repository";

export async function serializeCatalogProperty(property: CatalogProperty) {
  const images = (await Promise.all(property.images.map(async (image) => ({ id: image.id, url: await createStorageSignedUrl(PROPERTY_IMAGES_BUCKET, image.storagePath), isPrimary: image.isPrimary, displayOrder: image.displayOrder })))).filter((image) => image.url);
  return { id: property.id, title: property.title, address: property.address, monthlyRent: Number(property.monthlyRent), status: property.status, description: property.description, bedrooms: property.bedrooms, bathrooms: property.bathrooms, latitude: property.latitude === null ? null : Number(property.latitude), longitude: property.longitude === null ? null : Number(property.longitude), landlord: property.landlord, services: property.services, amenities: property.amenities, images, image: images.find((image) => image.isPrimary)?.url ?? images[0]?.url ?? null, createdAt: property.createdAt.toISOString(), updatedAt: property.updatedAt.toISOString() };
}
