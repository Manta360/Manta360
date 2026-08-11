/**
 * KAN-14 — Crea (o actualiza) un usuario Municipio en PostgreSQL.
 * Uso:
 *   MUNICIPIO_EMAIL=... MUNICIPIO_PASSWORD=... npm run db:seed-municipio
 */
import { loadEnvConfig } from "@next/env";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

// `tsx` no carga .env automáticamente como Next.js; el seed sí lo necesita.
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

async function main() {
  const email = (
    process.env.MUNICIPIO_EMAIL ?? "municipio@manta360.gob.ec"
  ).toLowerCase();
  const password = process.env.MUNICIPIO_PASSWORD ?? "Municipio2026!";
  const fullName = process.env.MUNICIPIO_NAME ?? "Funcionario Municipal";
  const phone = process.env.MUNICIPIO_PHONE ?? "052612345";
  const nationalId = process.env.MUNICIPIO_CEDULA ?? "0000000000";

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      fullName,
      phone,
      nationalId,
      role: Role.MUNICIPIO,
      active: true,
    },
    create: {
      email,
      passwordHash,
      fullName,
      phone,
      nationalId,
      role: Role.MUNICIPIO,
      active: true,
    },
  });

  console.log("Usuario Municipio listo:");
  console.log({
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  });
  console.log("Contraseña usada:", password);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
