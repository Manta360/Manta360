import { createHash } from "node:crypto";

export const MAX_PROPERTY_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IDENTITY_DOCUMENT_BYTES = 10 * 1024 * 1024;

const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const documentMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

export type UploadKind = "property-image" | "identity-document";

export type ValidatedUpload = {
  buffer: Buffer;
  extension: "jpg" | "png" | "webp" | "pdf";
  fileSize: number;
  mimeType: string;
  originalName: string;
  sha256: string;
};

export class UploadValidationError extends Error {}

function extensionForMimeType(mimeType: string): ValidatedUpload["extension"] {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "pdf";
}

function hasValidSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function safeOriginalName(name: string): string {
  const basename = name.split(/[\\/]/).pop() ?? "archivo";
  return basename.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(0, 180) || "archivo";
}

export async function validateUpload(file: File, kind: UploadKind): Promise<ValidatedUpload> {
  const allowedMimeTypes = kind === "property-image" ? imageMimeTypes : documentMimeTypes;
  const maxBytes = kind === "property-image" ? MAX_PROPERTY_IMAGE_BYTES : MAX_IDENTITY_DOCUMENT_BYTES;

  if (!file || file.size <= 0) throw new UploadValidationError("El archivo está vacío");
  if (file.size > maxBytes) throw new UploadValidationError(`El archivo supera el límite de ${Math.round(maxBytes / 1024 / 1024)} MB`);
  if (!allowedMimeTypes.has(file.type)) throw new UploadValidationError("El formato del archivo no está permitido");

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasValidSignature(buffer, file.type)) throw new UploadValidationError("El contenido no coincide con el tipo MIME declarado");

  return {
    buffer,
    extension: extensionForMimeType(file.type),
    fileSize: buffer.byteLength,
    mimeType: file.type,
    originalName: safeOriginalName(file.name),
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}
