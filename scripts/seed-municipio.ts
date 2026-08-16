/**
 * Creates or refreshes the municipal service account in the verified PG_APP target.
 * Required: MUNICIPIO_PASSWORD. This script never prints credentials.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createTextId } from "../src/lib/ids";
import { hashPassword } from "../src/lib/password";
import { applicationPostgres } from "../src/lib/postgres-app";

async function main() {
  const password = process.env.MUNICIPIO_PASSWORD;
  if (!password) throw new Error("MUNICIPIO_PASSWORD es obligatoria para ejecutar el seed");

  const email = (process.env.MUNICIPIO_EMAIL ?? "municipio@manta360.gob.ec").toLowerCase();
  const fullName = process.env.MUNICIPIO_NAME ?? "Funcionario Municipal";
  const phone = process.env.MUNICIPIO_PHONE ?? "052612345";
  const nationalId = process.env.MUNICIPIO_CEDULA ?? "0000000000";
  const client = await applicationPostgres.connect();

  try {
    const passwordHash = await hashPassword(password);
    const result = await client.query<{ id: string; email: string; role: string }>(
      `INSERT INTO public.users (id,"fullName",email,phone,"nationalId","passwordHash",role,active,"updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,'MUNICIPIO'::"Role",true,CURRENT_TIMESTAMP)
       ON CONFLICT (email) DO UPDATE SET
         "fullName"=EXCLUDED."fullName", phone=EXCLUDED.phone, "nationalId"=EXCLUDED."nationalId",
         "passwordHash"=EXCLUDED."passwordHash", role='MUNICIPIO'::"Role", active=true,
         "disabledAt"=NULL, "disabledBy"=NULL, "disableReason"=NULL, "updatedAt"=CURRENT_TIMESTAMP
       RETURNING id,email,role`,
      [createTextId(), fullName, email, phone, nationalId, passwordHash],
    );
    console.log(`Usuario Municipio listo: ${result.rows[0]?.id ?? "sin-id"} (${result.rows[0]?.role ?? "MUNICIPIO"})`);
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error("No se pudo preparar el usuario Municipio:", error instanceof Error ? error.message : "error desconocido");
  process.exitCode = 1;
});
