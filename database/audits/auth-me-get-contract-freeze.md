# Contract freeze — `GET /api/auth/me`

## Session and authorization

The route calls `getSession()` directly, not `getActiveSession()`. Missing or
invalid cookies/JWTs therefore yield HTTP 401 with `{ "user": null }` before
any database query.

For a valid session, the historical route executes:

```ts
prisma.user.findUnique({ where: { id: session.sub } });
```

It then returns the same HTTP 401 body when the user does not exist or when
`user.active` is false. This is the route's independent revocation check and
must remain even though `server-auth` already has its own PostgreSQL-backed
active-session validation.

## Historical public response

For an active user, `toPublicUser(user)` returns HTTP 200:

```json
{
  "user": {
    "id": "…",
    "email": "…",
    "fullName": "…",
    "phone": null,
    "nationalId": null,
    "role": "ARRENDATARIO",
    "active": true,
    "createdAt": "ISO-8601"
  }
}
```

There are no custom response headers. `passwordHash`, tokens, `updatedAt`,
disabled metadata, and all other fields are excluded by the serializer.
