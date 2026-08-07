import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ValidatedUpload } from "@/lib/file-validation";

export const PROPERTY_IMAGES_BUCKET = process.env.SUPABASE_PROPERTY_IMAGES_BUCKET ?? "property-images";
export const IDENTITY_DOCUMENTS_BUCKET = process.env.SUPABASE_IDENTITY_DOCUMENTS_BUCKET ?? "identity-documents";

export function propertyImagePath(propertyId: string, extension: string): string {
  return `properties/${propertyId}/${randomUUID()}.${extension}`;
}

export function identityDocumentPath(userId: string, extension: string): string {
  return `identity-documents/${userId}/${randomUUID()}.${extension}`;
}

export async function uploadStorageFile(bucket: string, path: string, upload: ValidatedUpload): Promise<void> {
  const { error } = await createSupabaseServerClient().storage.from(bucket).upload(path, upload.buffer, {
    contentType: upload.mimeType,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir el archivo a Storage: ${error.message}`);
}

export async function removeStorageFile(bucket: string, path: string): Promise<void> {
  const { error } = await createSupabaseServerClient().storage.from(bucket).remove([path]);
  if (error) throw new Error(`No se pudo eliminar el archivo de Storage: ${error.message}`);
}

export async function createStorageSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await createSupabaseServerClient().storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    console.error("storage signed url error", { bucket, path, message: error.message });
    return null;
  }
  return data.signedUrl;
}
