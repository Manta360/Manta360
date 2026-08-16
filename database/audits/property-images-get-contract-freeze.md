# Contract freeze — `GET /api/properties/[propertyId]/images`

## Authorization and ownership

The route requires `getActiveSession()`. A missing session receives HTTP 401
with `{ "error": "Sesión requerida" }`; an authenticated role other than
`ARRENDADOR`, including `ARRENDATARIO` and `MUNICIPIO`, receives HTTP 403 with
`{ "error": "Operación no permitida" }`.

The historical GET uses `getOwnedProperty(propertyId, session.sub)`, which
executes `prisma.properties.findFirst` with `{ id: propertyId, landlordId:
session.sub }` and selects only `id` and `status`. A missing property and a
property owned by another landlord both return HTTP 404 with `{ "error":
"Propiedad no encontrada" }`.

## Historical image query and response

After ownership validation, the GET uses:

```ts
prisma.property_images.findMany({
  where: { propertyId },
  orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
});
```

It returns HTTP 200 and `{ images }`, including only `id`, signed `url`,
`isPrimary`, and `displayOrder`. An empty property returns `{ "images": [] }`.
`storagePath`, `sha256`, timestamps, and file metadata are not exposed.

Each URL is generated through the unchanged
`createStorageSignedUrl(PROPERTY_IMAGES_BUCKET, image.storagePath)` call. The
bucket is `property-images` unless its existing environment override is set;
the helper's unchanged default TTL is 3600 seconds. The success response has
`Cache-Control: no-store, max-age=0`.

## Write isolation

POST continues to use its existing Prisma-backed `getOwnedProperty`, image
count, hash, and create operations. This checkpoint changes only GET metadata
reads; it does not alter Supabase Storage, upload validation, or writes.
