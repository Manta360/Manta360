# Server-auth contract freeze

## Scope audited

`src/lib/server-auth.ts` exports only `getActiveSession()`.

## Current behavior before the PostgreSQL migration

| Situation | `getSession()` | Prisma lookup | Result from `getActiveSession()` |
| --- | --- | --- | --- |
| No session cookie | `null` | None | `null` |
| Invalid or expired JWT | `null` | None | `null` |
| Valid session, user does not exist | `SessionPayload` | `user.findUnique` returns `null` | `null` |
| Valid session, user is inactive | `SessionPayload` | `{ id, active: false }` | `null` |
| Valid session, active user | `SessionPayload` | `{ id, active: true }` | The original `SessionPayload` object |

The Prisma query is equivalent to:

```ts
prisma.user.findUnique({
  where: { id: session.sub },
  select: { id: true, active: true },
});
```

No password hash, token, email, phone, national ID, or role is queried from
the database. The helper does not compare the role in the JWT with a database
role; callers continue to receive the role, subject, email, and full name from
the verified JWT payload.

`getSession()` owns cookie retrieval and JWT verification. It returns `null`
for malformed, expired, missing, or incomplete tokens. `getActiveSession()`
does not catch database errors: lookup failures propagate to its caller, while
all non-valid session states above return `null`.

## Frozen compatibility requirements

- Cookie name, JWT algorithm, secret, expiry, and claims stay in `session.ts`.
- `SessionPayload` remains `{ sub, email, role, fullName }`.
- The active-user lookup is solely a revocation check using `session.sub`.
- Roles remain JWT claims; middleware is not imported or changed by this
  helper.
- A deactivated or missing user invalidates an otherwise valid JWT.
