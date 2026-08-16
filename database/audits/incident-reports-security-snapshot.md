# Incident reports security
Lectura debe preservar filtros explícitos de sesión. La query selecciona exclusivamente columnas expuestas por Prisma y no usa `users.*`; no incluye passwordHash, nationalId ni tokens. Base real no modificada.
