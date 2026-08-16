# GET `/api/contracts/[id]/pdf` contract freeze

## Classification

**READ-ONLY.** No invoca lifecycle, reconciliación, transacciones, almacenamiento ni writes.

## HTTP contract histórico

| Caso | Acceso | Status | Resultado |
| --- | --- | --- | --- |
| Sin sesión | No permitido | 401 | JSON `{ error: "Sesion requerida" }` |
| Tenant participante | `tenantId === session.sub` | 200 | PDF binario |
| Tenant ajeno | No participante | 404 | JSON `{ error: "Contrato no encontrado" }` |
| Landlord participante | `landlordId === session.sub` | 200 | PDF binario |
| Landlord ajeno | No participante | 404 | JSON `{ error: "Contrato no encontrado" }` |
| Municipio | Permitido | 200 | PDF binario |
| ID inexistente | No encontrado | 404 | JSON `{ error: "Contrato no encontrado" }` |

- Prisma histórico: `contracts.findUnique({ where: { id }, select })`.
- Proyección: `id`, participantes, estado, fechas, renta, propósito, método de pago; propiedad `{ title, address }`; partes `{ fullName, nationalId }`.
- Autorización posterior a la búsqueda, derivada exclusivamente de sesión.
- Headers de éxito: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="contrato-{id}.pdf"`, `Cache-Control: private, no-store`.
- Generador: `createContractPdf`, sin cambios. Produce bytes con firma `%PDF-1.4` y presenta estado, propiedad, partes, fechas UTC, canon, destino y pago.
- `monthlyRent` se convertía a `Number(...)` antes de invocar el generador. No se incluían `passwordHash`, correo, tokens ni secretos.
- El handler histórico no captura el error de query; se preserva el manejo genérico del framework para fallas inesperadas de datos.
