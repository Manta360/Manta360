import "dotenv/config";
import { postgres, queryPostgres, testPostgresConfig } from "../src/lib/postgres";

const EXPECTED_TEST_PROJECT_REF = "ycerwszvzkmyisflxkpe";
const EXPECTED_TABLES = [
  "amenity_catalog", "chat_messages", "contract_renewal_requests", "contract_requests", "contracts", "identity_document_reviews", "identity_documents", "incident_reports", "properties", "property_amenities", "property_images", "property_services", "service_catalog", "users",
] as const;
const EXPECTED_ENUMS: Record<string, string[]> = {
  Role: ["ARRENDADOR", "ARRENDATARIO", "MUNICIPIO"],
  ContractStatus: ["PENDIENTE_FIRMA", "PENDIENTE_MUNICIPIO", "ACTIVO", "RECHAZADO_MUNICIPIO", "FINALIZADO", "EN_RENOVACION"],
  IdentityDocumentStatus: ["PENDIENTE", "EN_REVISION", "VERIFICADO", "RECHAZADO"],
  IdentityDocumentType: ["CEDULA", "PASAPORTE"],
  IncidentStatus: ["PENDIENTE", "EN_PROCESO", "RESUELTO"],
  PropertyStatus: ["DISPONIBLE", "OCUPADO", "MANTENIMIENTO", "INHABILITADO"],
  RequestStatus: ["PENDIENTE", "APROBADO", "RECHAZADO"],
};
const REQUIRED_CONSTRAINTS = [
  "contracts_end_date_after_start_date",
  "contract_requests_end_date_after_start_date",
];
const EXPECTED_PRIMARY_KEYS = [
  "amenity_catalog_pkey", "chat_messages_pkey", "contract_renewal_requests_pkey", "contract_requests_pkey", "contracts_pkey", "identity_document_reviews_pkey", "identity_documents_pkey", "incident_reports_pkey", "properties_pkey", "property_amenities_pkey", "property_images_pkey", "property_services_pkey", "service_catalog_pkey", "users_pkey",
];
const EXPECTED_FOREIGN_KEYS = [
  "properties_landlordid_fkey", "properties_createdby_fkey", "property_services_property_fkey", "property_services_service_fkey", "property_amenities_property_fkey", "property_amenities_amenity_fkey", "property_images_property_fkey", "contract_requests_propertyid_fkey", "contract_requests_tenantid_fkey", "contracts_propertyid_fkey", "contracts_tenantid_fkey", "contracts_landlordid_fkey", "incident_reports_contractid_fkey", "incident_reports_propertyid_fkey", "incident_reports_tenantid_fkey", "incident_reports_landlordid_fkey", "identity_documents_user_fkey", "identity_documents_uploaded_by_fkey", "identity_documents_reviewer_fkey", "identity_document_reviews_document_fkey", "identity_document_reviews_reviewer_fkey",
];
const EXPECTED_UNIQUES = [
  "users_email_key", "users_nationalid_key", "service_catalog_name_unique", "service_catalog_slug_unique", "amenity_catalog_name_unique", "amenity_catalog_slug_unique", "property_images_storage_path_unique", "property_images_property_sha256_idx", "identity_documents_storage_path_unique",
];
const REQUIRED_INDEXES = [
  "users_role_idx", "properties_landlordid_idx", "properties_status_idx", "properties_created_by_created_at_id_idx", "properties_landlord_created_at_id_idx", "properties_status_created_at_id_idx", "properties_status_monthly_rent_idx", "property_services_service_property_idx", "property_amenities_amenity_property_idx", "property_images_property_order_idx", "contract_requests_propertyid_status_idx", "contract_requests_tenantid_status_idx", "contracts_landlordid_status_idx", "contracts_propertyid_status_idx", "contracts_tenantid_status_idx", "contracts_one_effective_contract_per_property", "contracts_status_end_date_idx", "contract_renewal_requests_contractid_status_idx", "contract_renewal_requests_requestedby_status_idx", "incident_reports_contractid_status_idx", "incident_reports_tenantid_status_idx", "incident_reports_landlordid_status_idx", "identity_documents_status_uploaded_idx", "identity_documents_uploaded_by_created_idx", "identity_documents_user_uploaded_idx", "identity_documents_current_side_unique", "identity_document_reviews_document_created_idx", "identity_document_reviews_reviewer_created_idx", "chat_messages_propertyid_createdat_idx", "chat_messages_senderid_recipientid_createdat_idx",
];

function assertTemporaryProject() {
  if (testPostgresConfig.user !== `postgres.${EXPECTED_TEST_PROJECT_REF}`) {
    throw new Error("El usuario configurado no corresponde a la base temporal manta360prueba");
  }
}

function requirePresent(actual: string[], expected: readonly string[], label: string) {
  const missing = expected.filter((item) => !actual.includes(item));
  if (missing.length > 0) throw new Error(`${label} faltantes: ${missing.join(", ")}`);
}

async function main() {
  assertTemporaryProject();
  const context = await queryPostgres<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
  if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") {
    throw new Error("La sesión activa no coincide con la base temporal configurada");
  }

  const [tables, enumRows, columns, constraints, indexes, foreignKeys] = await Promise.all([
    queryPostgres<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"),
    queryPostgres<{ enum_name: string; enum_value: string }>("SELECT t.typname AS enum_name, e.enumlabel AS enum_value FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder"),
    queryPostgres<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name IN ('endedAt', 'endedBy') ORDER BY column_name"),
    queryPostgres<{ constraint_name: string; constraint_type: string }>("SELECT conname AS constraint_name, contype::text AS constraint_type FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conname"),
    queryPostgres<{ index_name: string }>("SELECT indexname AS index_name FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname"),
    queryPostgres<{ foreign_keys: string }>("SELECT count(*)::text AS foreign_keys FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'"),
  ]);

  requirePresent(tables.rows.map(({ table_name }) => table_name), EXPECTED_TABLES, "Tablas");
  requirePresent(columns.rows.map(({ column_name }) => column_name), ["endedAt", "endedBy"], "Columnas de contracts");
  requirePresent(constraints.rows.filter(({ constraint_type }) => constraint_type === "p").map(({ constraint_name }) => constraint_name), EXPECTED_PRIMARY_KEYS, "Primary keys");
  requirePresent(constraints.rows.filter(({ constraint_type }) => constraint_type === "f").map(({ constraint_name }) => constraint_name), EXPECTED_FOREIGN_KEYS, "Foreign keys");
  requirePresent(constraints.rows.filter(({ constraint_type }) => constraint_type === "u").map(({ constraint_name }) => constraint_name), EXPECTED_UNIQUES, "Unique constraints");
  requirePresent(constraints.rows.filter(({ constraint_type }) => constraint_type === "c").map(({ constraint_name }) => constraint_name), REQUIRED_CONSTRAINTS, "Check constraints");
  requirePresent(indexes.rows.map(({ index_name }) => index_name), REQUIRED_INDEXES, "Índices");

  for (const [name, values] of Object.entries(EXPECTED_ENUMS)) {
    const actual = enumRows.rows.filter(({ enum_name }) => enum_name === name).map(({ enum_value }) => enum_value);
    if (actual.join("|") !== values.join("|")) throw new Error(`Enum ${name} no coincide con el contrato actual`);
  }

  console.log("POSTGRES SCHEMA VERIFICATION: OK");
  console.log(`tables: ${EXPECTED_TABLES.length}`);
  console.log(`enums: ${Object.keys(EXPECTED_ENUMS).length}`);
  console.log(`primary_keys: ${EXPECTED_PRIMARY_KEYS.length}`);
  console.log(`foreign_keys: ${foreignKeys.rows[0]?.foreign_keys ?? "0"}`);
  console.log(`unique_constraints: ${EXPECTED_UNIQUES.length}`);
  console.log(`check_constraints: ${REQUIRED_CONSTRAINTS.length}`);
  console.log(`functional_indexes: ${REQUIRED_INDEXES.length}`);
  console.log("contracts.endedAt: OK");
  console.log("contracts.endedBy: OK");
  console.log("contracts_one_effective_contract_per_property: OK");
  console.log("contracts_status_end_date_idx: OK");
  console.log("contracts_end_date_after_start_date: OK");
  console.log("contract_requests_end_date_after_start_date: OK");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Schema verification failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.end();
  });
