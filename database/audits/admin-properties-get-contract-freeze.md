# Contract freeze — `GET /api/admin/properties`

## Authorization and status codes

The route calls `getActiveSession()`. When there is no active session or its
JWT role is not `MUNICIPIO`, it returns HTTP 403 with:

```json
{ "error": "Acceso exclusivo del Municipio" }
```

An active `MUNICIPIO` receives HTTP 200. There are no client query parameters,
pagination, or data filters in the historical handler.

## Historical Prisma behavior

`prisma.properties.findMany` loads every property, ordered by
`createdAt DESC`, and includes its landlord through
`users_properties_landlordIdTousers` with this exact projection:

`id`, `fullName`, `email`, `phone`, `nationalId`, `active`, `disabledAt`,
`disableReason`.

The handler spreads every scalar property field into the response and converts
only `monthlyRent` from Prisma Decimal to a JavaScript number. It does not
filter by approval, status, landlord activity, or ownership.

## Response contract

```ts
{
  properties: Array<properties & {
    monthlyRent: number;
    users_properties_landlordIdTousers: {
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
      nationalId: string | null;
      active: boolean;
      disabledAt: Date | null;
      disableReason: string | null;
    };
  }>;
  stats: {
    users: number;
    pendingProperties: number;
    occupiedProperties: number;
    activeContracts: number;
    disabledLandlords: number;
    disabledProperties: number;
  };
}
```

Dates and nulls retain the normal JSON serialization produced by Next.js.

## Frozen administrative counters

| JSON key | Historical Prisma query | Meaning |
| --- | --- | --- |
| `users` | `user.count()` | All users, without role or active filter. |
| `pendingProperties` | `properties.count({ approved: false })` | Properties not approved, regardless of status. |
| `occupiedProperties` | `properties.count({ status: "OCUPADO" })` | Properties whose current status is occupied. |
| `activeContracts` | `contracts.count({ status: "ACTIVO" })` | Contracts whose current status is active. |
| `disabledLandlords` | `user.count({ role: "ARRENDADOR", active: false })` | Inactive landlords only. |
| `disabledProperties` | `properties.count({ status: "INHABILITADO" })` | Municipally disabled properties. |

All counters are JSON numbers and preserve zero.
