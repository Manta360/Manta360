-- KAN-14: Alta manual del rol Municipio (no disponible en registro público).
-- Ejecutar en el SQL Editor de Supabase.
-- Sustituye el hash por el valor producido al ejecutar: npm run db:seed-municipio
-- Ejemplo (password: Municipio2026!):

INSERT INTO users (id, email, "passwordHash", "fullName", phone, role, active, "createdAt", "updatedAt")
VALUES (
  'municipio-seed-001',
  'municipio@manta360.gob.ec',
  '$2a$12$REPLACE_WITH_BCRYPT_HASH',
  'Funcionario Municipal',
  '052612345',
  'MUNICIPIO',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;
