# Contract freeze — `GET /api/admin/users/[id]`

## Authorization

The route calls `municipioSession()`, which requires an active session whose
JWT role is `MUNICIPIO`. Missing sessions, `ARRENDADOR`, and `ARRENDATARIO`
all receive HTTP 403 with `{ "error": "Acceso exclusivo del Municipio" }`.

## Historical Prisma query

The GET invokes the shared `findLandlord(id)` helper:

```ts
prisma.user.findFirst({
  where: { id, role: "ARRENDADOR" },
  select: landlordSelect,
});
```

`landlordSelect` contains only `id`, `fullName`, `email`, `phone`,
`nationalId`, `role`, `active`, `disabledAt`, `disabledBy`, `disableReason`,
`createdAt`, and `updatedAt`. It does not load properties or counts.

An unknown id, or an existing id whose role is not `ARRENDADOR`, receives HTTP
404 with `{ "error": "Arrendador no encontrado" }`.

## Response contract

The HTTP 200 response is `{ landlord }`. It contains the historical personal
and administrative fields above, with `createdAt`, `updatedAt`, and
`disabledAt` serialized as ISO strings; nullable fields remain `null`.
`passwordHash`, tokens, and any other internal fields are absent.

`findLandlord()` is also used by PATCH. It remains Prisma-backed during this
checkpoint so PATCH behavior is unchanged.
