import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { IdentityRepository, type IdentitySqlExecutor } from "../src/repositories/identity.repository";

const EXPECTED_TEST_PROJECT_REF = "ycerwszvzkmyisflxkpe";

async function main() {
  if (testPostgresConfig.user !== `postgres.${EXPECTED_TEST_PROJECT_REF}`) throw new Error("El usuario configurado no corresponde a manta360prueba");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("La sesion no corresponde a la base temporal");
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",role,\"updatedAt\") VALUES ($1,$2,$3,$4,'ARRENDATARIO',CURRENT_TIMESTAMP),($5,$6,$3,$7,'ARRENDADOR',CURRENT_TIMESTAMP)",
      ["identity-user-a", "identity-user-a@example.test", "hash-not-public", "User A", "identity-user-b", "identity-user-b@example.test", "User B"],
    );
    await client.query(
      "INSERT INTO public.identity_documents (\"userId\",\"uploadedBy\",\"documentType\",side,\"storagePath\",\"originalName\",extension,\"mimeType\",\"fileSize\",sha256,\"verificationStatus\",\"uploadedAt\",\"reviewedAt\",\"reviewNotes\",\"expiresAt\",\"isCurrent\",\"updatedAt\") VALUES ($1,$1,'PASAPORTE','UNICA',$2,'passport.jpg','jpg','image/jpeg',12,$3,'EN_REVISION','2026-01-04',NULL,NULL,'2027-01-01',true,CURRENT_TIMESTAMP),($1,$1,'CEDULA','FRENTE',$4,'front.jpg','jpg','image/jpeg',13,$5,'PENDIENTE','2026-01-03',NULL,NULL,NULL,true,CURRENT_TIMESTAMP),($1,$1,'CEDULA','REVERSO',$6,'back.jpg','jpg','image/jpeg',14,$7,'VERIFICADO','2026-01-02','2026-01-03','Documento valido',NULL,true,CURRENT_TIMESTAMP),($1,$1,'PASAPORTE','UNICA',$8,'old.pdf','pdf','application/pdf',15,$9,'RECHAZADO','2026-01-01','2026-01-02','Documento vencido',NULL,false,CURRENT_TIMESTAMP),($10,$10,'PASAPORTE','UNICA',$11,'other.jpg','jpg','image/jpeg',16,$12,'VERIFICADO','2026-01-05',NULL,NULL,NULL,true,CURRENT_TIMESTAMP)",
      ["identity-user-a", "identity-documents/a/passport.jpg", "a".repeat(64), "identity-documents/a/front.jpg", "b".repeat(64), "identity-documents/a/back.jpg", "c".repeat(64), "identity-documents/a/old.pdf", "d".repeat(64), "identity-user-b", "identity-documents/b/other.jpg", "e".repeat(64)],
    );

    const repository = new IdentityRepository(client as unknown as IdentitySqlExecutor);
    const documents = await repository.listDocumentsForUser("identity-user-a");
    if (documents.length !== 4) throw new Error("El historial de documentos no coincide");
    if (documents.map((document) => `${document.documentType}:${document.side}:${document.isCurrent}`).join("|") !== "PASAPORTE:UNICA:true|CEDULA:FRENTE:true|CEDULA:REVERSO:true|PASAPORTE:UNICA:false") throw new Error("El orden actual/historico no coincide");
    if (documents.map((document) => document.verificationStatus).join("|") !== "EN_REVISION|PENDIENTE|VERIFICADO|RECHAZADO") throw new Error("Los estados no coinciden");
    if (documents[0]?.expiresAt?.getFullYear() !== 2027 || documents[2]?.reviewNotes !== "Documento valido" || documents[1]?.reviewedAt !== null) throw new Error("Metadatos de revision, fechas o nulls no coinciden");
    if (JSON.stringify(documents).includes("passwordHash") || JSON.stringify(documents).includes("reviewedBy")) throw new Error("La consulta expuso datos internos");
    if ((await repository.listDocumentsForUser("identity-user-b")).length !== 1) throw new Error("Usuario B no quedo aislado");
    if ((await repository.listDocumentsForUser("missing-user")).length !== 0) throw new Error("Usuario inexistente no devolvio lista vacia");

    await client.query("ROLLBACK");
    console.log("POSTGRES IDENTITY DOCUMENTS INTEGRATION: OK");
    console.log("ownership_history_and_order: OK");
    console.log("sides_types_statuses_and_dates: OK");
    console.log("sensitive_fields: OK");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Identity documents integration failed");
    process.exitCode = 1;
  })
  .finally(async () => { await postgres.end(); });
