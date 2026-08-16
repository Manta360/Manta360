import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_REF = "ycerwszvzkmyisflxkpe";

const buckets = [
  {
    name: "property-images",
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    signedUrlTtl: 3600,
  },
  {
    name: "identity-documents",
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    signedUrlTtl: 300,
  },
] as const;

type ExpectedBucket = (typeof buckets)[number];
type StorageBucket = {
  name: string;
  public: boolean;
  file_size_limit: number | string | null;
  allowed_mime_types: string[] | null;
};

const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9qQAAAABJRU5ErkJggg==",
  "base64",
);

function requiredTestEnv(name: "SUPABASE_TEST_URL" | "SUPABASE_TEST_SERVICE_ROLE_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no está definido`);
  return value;
}

function validateTestProject(url: string): string {
  const parsed = new URL(url);
  const ref = parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];

  if (ref !== EXPECTED_PROJECT_REF) {
    throw new Error("SUPABASE_TEST_URL no corresponde al proyecto manta360prueba");
  }

  return ref;
}

function sameMimeTypes(actual: string[] | null, expected: readonly string[]): boolean {
  if (!actual || actual.length !== expected.length) return false;
  return actual.every((mimeType) => expected.includes(mimeType)) && expected.every((mimeType) => actual.includes(mimeType));
}

function verifyBucket(bucket: StorageBucket, expected: ExpectedBucket): void {
  if (bucket.public) throw new Error(`El bucket ${expected.name} no es privado`);
  if (Number(bucket.file_size_limit) !== expected.fileSizeLimit) throw new Error(`El límite de ${expected.name} no coincide`);
  if (!sameMimeTypes(bucket.allowed_mime_types, expected.allowedMimeTypes)) throw new Error(`Los MIME de ${expected.name} no coinciden`);
}

async function verifyTemporaryObject(
  storage: ReturnType<typeof createClient>["storage"],
  expected: ExpectedBucket,
): Promise<void> {
  const path = `_bootstrap-check/${randomUUID()}.png`;
  let uploaded = false;

  try {
    const { error: uploadError } = await storage.from(expected.name).upload(path, testPng, {
      contentType: "image/png",
      cacheControl: "0",
      upsert: false,
    });
    if (uploadError) throw new Error(`No se pudo subir el objeto temporal a ${expected.name}`);
    uploaded = true;

    const { data: signedData, error: signedError } = await storage.from(expected.name).createSignedUrl(path, expected.signedUrlTtl);
    if (signedError || !signedData?.signedUrl) throw new Error(`No se pudo generar una URL firmada para ${expected.name}`);

    const response = await fetch(signedData.signedUrl);
    if (!response.ok) throw new Error(`La URL firmada de ${expected.name} no fue utilizable`);

    console.log(`TEMPORARY_OBJECT ${expected.name}: upload=OK signed_url=OK access=OK`);
  } finally {
    if (uploaded) {
      const { error: cleanupError } = await storage.from(expected.name).remove([path]);
      if (cleanupError) throw new Error(`No se pudo eliminar el objeto temporal de ${expected.name}`);
      console.log(`TEMPORARY_OBJECT ${expected.name}: cleanup=OK`);
    }
  }
}

async function main(): Promise<void> {
  const url = requiredTestEnv("SUPABASE_TEST_URL");
  const serviceRoleKey = requiredTestEnv("SUPABASE_TEST_SERVICE_ROLE_KEY");
  const projectRef = validateTestProject(url);
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  const { data: listedBuckets, error: listError } = await supabase.storage.listBuckets();
  if (listError || !listedBuckets) throw new Error("No se pudieron listar los buckets de prueba");

  const knownBuckets = listedBuckets as StorageBucket[];
  const created: string[] = [];

  for (const expected of buckets) {
    const existing = knownBuckets.find((bucket) => bucket.name === expected.name);
    if (existing) {
      verifyBucket(existing, expected);
      console.log(`BUCKET ${expected.name}: existing private=OK mime=OK limit=OK`);
      continue;
    }

    const { error: createError } = await supabase.storage.createBucket(expected.name, {
      public: false,
      fileSizeLimit: expected.fileSizeLimit,
      allowedMimeTypes: [...expected.allowedMimeTypes],
    });
    if (createError) throw new Error(`No se pudo crear el bucket ${expected.name}`);
    created.push(expected.name);
  }

  const { data: verifiedBuckets, error: verifyError } = await supabase.storage.listBuckets();
  if (verifyError || !verifiedBuckets) throw new Error("No se pudieron verificar los buckets de prueba");

  for (const expected of buckets) {
    const bucket = (verifiedBuckets as StorageBucket[]).find((candidate) => candidate.name === expected.name);
    if (!bucket) throw new Error(`El bucket ${expected.name} no existe después del bootstrap`);
    verifyBucket(bucket, expected);
    console.log(`BUCKET ${expected.name}: ${created.includes(expected.name) ? "created" : "existing"} private=OK mime=OK limit=OK`);
  }

  for (const expected of buckets) await verifyTemporaryObject(supabase.storage, expected);

  console.log(`STORAGE TEST PROJECT: ${projectRef}`);
  console.log("STORAGE BOOTSTRAP: OK");
}

main().catch(() => {
  console.error("STORAGE BOOTSTRAP: ERROR (no secrets logged)");
  process.exitCode = 1;
});
