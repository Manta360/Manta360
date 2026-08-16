import "dotenv/config";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { IdentityRepository, type IdentitySqlExecutor } from "../src/repositories/identity.repository";

const PROJECT = "ycerwszvzkmyisflxkpe";
async function main() {
  if (testPostgresConfig.user !== `postgres.${PROJECT}`) throw new Error("Destino temporal no confirmado");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") throw new Error("Sesion fuera de manta360prueba");
    await client.query("BEGIN");
    await client.query("INSERT INTO public.users (id,email,\"passwordHash\",\"fullName\",role,\"updatedAt\") VALUES ($1,$2,$3,$4,'MUNICIPIO',CURRENT_TIMESTAMP),($5,$6,$3,$7,'ARRENDADOR',CURRENT_TIMESTAMP),($8,$9,$3,$10,'ARRENDATARIO',CURRENT_TIMESTAMP)", ["review-municipio","review-municipio@test","hash","Municipio","review-landlord","review-landlord@test","Landlord","review-tenant","review-tenant@test","Tenant"]);
    await client.query("INSERT INTO public.identity_documents (\"userId\",\"uploadedBy\",\"documentType\",side,\"storagePath\",\"originalName\",extension,\"mimeType\",\"fileSize\",sha256,\"verificationStatus\",\"uploadedAt\",\"reviewedAt\",\"reviewNotes\",\"expiresAt\",\"isCurrent\",\"updatedAt\") VALUES ($1,$1,'CEDULA','FRENTE',$2,'front.jpg','jpg','image/jpeg',10,$3,'PENDIENTE','2026-01-03',NULL,NULL,NULL,true,CURRENT_TIMESTAMP),($1,$1,'CEDULA','REVERSO',$4,'back.jpg','jpg','image/jpeg',11,$5,'VERIFICADO','2026-01-02','2026-01-03','Validado','2027-01-01',true,CURRENT_TIMESTAMP),($6,$6,'PASAPORTE','UNICA',$7,'passport.pdf','pdf','application/pdf',12,$8,'RECHAZADO','2026-01-01','2026-01-02','Vencido',NULL,false,CURRENT_TIMESTAMP)", ["review-tenant","identity/a/front.jpg","a".repeat(64),"identity/a/back.jpg","b".repeat(64),"review-landlord","identity/b/passport.pdf","c".repeat(64)]);
    const repository = new IdentityRepository(client as unknown as IdentitySqlExecutor);
    const all = await repository.listReviewDocuments(null);
    if (all.map((d) => `${d.verificationStatus}:${d.id}`).length !== 3) throw new Error("Listado completo incorrecto");
    if (all.map((d) => d.verificationStatus).join("|") !== "PENDIENTE|VERIFICADO|RECHAZADO") throw new Error("Orden de estados incorrecto");
    const pending = await repository.listReviewDocuments("PENDIENTE");
    if (pending.length !== 1 || pending[0]?.user.email !== "review-tenant@test" || pending[0]?.uploadedBy.fullName !== "Tenant") throw new Error("Filtro o joins incorrectos");
    const reviewed = all.find((d) => d.verificationStatus === "VERIFICADO");
    if (!reviewed || reviewed.side !== "REVERSO" || !reviewed.isCurrent || reviewed.reviewNotes !== "Validado" || reviewed.reviewedAt === null || reviewed.expiresAt === null) throw new Error("Metadatos de revision incorrectos");
    if (JSON.stringify(all).includes("passwordHash") || JSON.stringify(all).includes("nationalId")) throw new Error("Datos sensibles expuestos");
    await client.query("ROLLBACK");
    console.log("POSTGRES IDENTITY REVIEW INTEGRATION: OK"); console.log("filter_order_joins_metadata: OK"); console.log("sensitive_fields: OK"); console.log("persistent_fixture_data: none");
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Identity review integration failed"); process.exitCode = 1; }).finally(async () => { await postgres.end(); });
