# Security snapshot — `GET /api/admin/properties`

Catalog metadata captured read-only from the original database on 2026-08-16.
No business rows, DDL, or writes were executed.

| Table | RLS / forced RLS | Policies | Historical grants | Relevant structure |
| --- | --- | --- | --- | --- |
| `properties` | Disabled / disabled | None | `prisma`: SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE | PK; landlord and creator FKs; indexes by landlord/status/createdAt; six historical `NOT VALID` checks for title, rent, bedrooms, bathrooms, latitude and longitude. |
| `users` | Enabled / forced | None | `prisma`: SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE | PK; unique email/national ID; `users_role_idx`. |
| `contracts` | Disabled / disabled | None | `prisma`: SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE | PK; tenant, landlord and property FKs; indexes by tenant/landlord/property and status. |

The current handler does not rely on RLS. Authorization is enforced before
data access by requiring `getActiveSession()` and `MUNICIPIO`.

The original catalog reports no additional policies. The query must preserve
the historical landlord projection while excluding `passwordHash`, tokens and
any columns not selected by Prisma.
