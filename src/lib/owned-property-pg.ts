import { createStorageSignedUrl, PROPERTY_IMAGES_BUCKET } from "@/lib/supabase/storage";
import type { MineProperty } from "@/repositories/properties.repository";

export async function serializeMineProperty(property: MineProperty) {
  const images = (await Promise.all(property.images.map(async (image) => ({ id: image.id, url: await createStorageSignedUrl(PROPERTY_IMAGES_BUCKET, image.storagePath), isPrimary: image.isPrimary, displayOrder: image.displayOrder })))).filter((image) => image.url);
  return { id: property.id, title: property.title, address: property.address, monthlyRent: Number(property.monthlyRent), bedrooms: property.bedrooms, bathrooms: property.bathrooms, description: property.description, latitude: property.latitude === null ? null : Number(property.latitude), longitude: property.longitude === null ? null : Number(property.longitude), status: property.status, approved: property.approved, disableReason: property.disableReason, createdAt: property.createdAt.toISOString(), updatedAt: property.updatedAt.toISOString(), services: property.services, amenities: property.amenities, images, image: images.find((image) => image.isPrimary)?.url ?? images[0]?.url ?? null };
}
