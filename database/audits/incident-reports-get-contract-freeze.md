# GET incident reports freeze
Sin sesión 401. Arrendatario filtra `tenantId=session.sub`; Arrendador `landlordId=session.sub`; Municipio y cualquier otro rol autenticado recibe todo. Prisma incluía property `{id,title,address}` y tenant `{id,fullName,email}`, orden `createdAt DESC`, sin query params ni filtros de estado. Response `{ reports }` sin transformación.
