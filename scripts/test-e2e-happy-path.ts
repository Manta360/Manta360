import "dotenv/config";
import {
  finalizeContractAndSynchronizeProperty,
  reservePropertyForContractActivation,
  synchronizePropertyContractState,
} from "../src/lib/property-contract-state";
import { postgres, testPostgresConfig } from "../src/lib/postgres";
import { AdminPropertiesRepository, type AdminPropertiesSqlExecutor } from "../src/repositories/admin-properties.repository";
import { ContractRequestsRepository, type ContractRequestsSqlExecutor } from "../src/repositories/contract-requests.repository";
import { ContractsRepository, type ContractsSqlExecutor } from "../src/repositories/contracts.repository";
import { IncidentsRepository, type IncidentsSqlExecutor } from "../src/repositories/incidents.repository";
import { PropertiesRepository, type PropertiesSqlExecutor } from "../src/repositories/properties.repository";

const PROJECT = "ycerwszvzkmyisflxkpe";
const IDS = {
  landlord: "e2e60-landlord",
  tenant: "e2e60-tenant",
  municipio: "e2e60-municipio",
  property: "e2e60-property",
  request: "e2e60-request",
  contract: "e2e60-contract",
  incident: "e2e60-incident",
} as const;

const completedSteps: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function step(label: string) {
  completedSteps.push(label);
  console.log(`OK  ${label}`);
}

async function propertyStatus(client: ContractsSqlExecutor, propertyId: string) {
  const result = await client.query<{ status: string }>('SELECT status::text AS status FROM public.properties WHERE id = $1', [propertyId]);
  return result.rows[0]?.status ?? null;
}

async function contractStatus(client: ContractsSqlExecutor, contractId: string) {
  const result = await client.query<{ status: string }>('SELECT status::text AS status FROM public.contracts WHERE id = $1', [contractId]);
  return result.rows[0]?.status ?? null;
}

async function main() {
  if (testPostgresConfig.user !== `postgres.${PROJECT}`) throw new Error("Destino temporal no confirmado");
  const client = await postgres.connect();
  try {
    const context = await client.query<{ database: string; role: string }>("SELECT current_database() AS database, current_user AS role");
    if (context.rows[0]?.database !== "postgres" || context.rows[0]?.role !== "postgres") {
      throw new Error("Sesion fuera de manta360prueba");
    }

    await client.query("BEGIN");

    const properties = new PropertiesRepository(client as unknown as PropertiesSqlExecutor);
    const adminProperties = new AdminPropertiesRepository(client as unknown as AdminPropertiesSqlExecutor);
    const requests = new ContractRequestsRepository(client as unknown as ContractRequestsSqlExecutor);
    const contracts = new ContractsRepository(client as unknown as ContractsSqlExecutor);
    const incidents = new IncidentsRepository(client as unknown as IncidentsSqlExecutor);

    // 1) Registro Arrendador
    await client.query(
      'INSERT INTO public.users (id,email,"passwordHash","fullName",role,"updatedAt") VALUES ($1,$2,$3,$4,\'ARRENDADOR\',CURRENT_TIMESTAMP)',
      [IDS.landlord, "e2e60-landlord@test", "hash", "E2E Landlord"],
    );
    step("Registro Arrendador");

    // 2) Crear propiedad (sin aprobar aún → no visible en catálogo público)
    await properties.createProperty(
      {
        id: IDS.property,
        landlordId: IDS.landlord,
        title: "E2E Happy Path KAN-60",
        address: "Manta Centro Calle 13",
        monthlyRent: 650,
        description: "Propiedad de prueba E2E",
        bedrooms: 2,
        bathrooms: 1,
        latitude: -0.95,
        longitude: -80.7,
      },
      [],
      [],
    );
    assert(await propertyStatus(client, IDS.property) === "DISPONIBLE", "La propiedad creada debe iniciar DISPONIBLE");
    const beforeApproval = await properties.listCatalogProperties({ location: null, minPrice: null, maxPrice: null, services: [] });
    assert(!beforeApproval.some((item) => item.id === IDS.property), "Sin aprobación municipal la propiedad no debe salir en el catálogo");
    step("Crear propiedad");

    // Aprobación municipal (requisito real para que el visitante la vea en el catálogo)
    await client.query(
      'INSERT INTO public.users (id,email,"passwordHash","fullName",role,"updatedAt") VALUES ($1,$2,$3,$4,\'MUNICIPIO\',CURRENT_TIMESTAMP)',
      [IDS.municipio, "e2e60-municipio@test", "hash", "E2E Municipio"],
    );
    const approvedAt = new Date("2026-08-17T10:00:00.000Z");
    const approved = await adminProperties.updateApproval(IDS.property, true, IDS.municipio, approvedAt);
    assert(approved?.approved === true, "La propiedad debe quedar aprobada por el municipio");
    step("Municipio aprueba propiedad (habilita catálogo público)");

    // 3) Visitante puede verla en el catálogo público
    const visitorCatalog = await properties.listCatalogProperties({ location: null, minPrice: null, maxPrice: null, services: [] });
    assert(visitorCatalog.some((item) => item.id === IDS.property), "El visitante debe ver la propiedad en el catálogo público");
    step("Visitante puede verla");

    // 4) Registro Arrendatario
    await client.query(
      'INSERT INTO public.users (id,email,"passwordHash","fullName",role,"updatedAt") VALUES ($1,$2,$3,$4,\'ARRENDATARIO\',CURRENT_TIMESTAMP)',
      [IDS.tenant, "e2e60-tenant@test", "hash", "E2E Tenant"],
    );
    step("Registro Arrendatario");

    // 5) Buscar (filtros de catálogo del arrendatario)
    const searchHits = await properties.listCatalogProperties({
      location: "Manta Centro",
      minPrice: 500,
      maxPrice: 800,
      services: [],
    });
    assert(searchHits.some((item) => item.id === IDS.property), "La búsqueda del arrendatario debe encontrar la propiedad");
    step("Buscar");

    // 6) Solicitar
    assert(await requests.propertyCanReceiveRequest(IDS.property), "La propiedad debe poder recibir solicitudes");
    await requests.createRequest({
      id: IDS.request,
      propertyId: IDS.property,
      tenantId: IDS.tenant,
      message: "Solicitud E2E KAN-60",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-09-01T00:00:00.000Z"),
    });
    step("Solicitar");

    // 7) Arrendador acepta → Contrato PENDIENTE_FIRMA
    const decision = await requests.findForLandlordDecision(IDS.request, IDS.landlord);
    assert(decision && decision.status === "PENDIENTE", "Solicitud pendiente no encontrada para el arrendador");
    await requests.setDecision(IDS.request, "APROBADO");
    await requests.createPendingContract({
      id: IDS.contract,
      propertyId: IDS.property,
      tenantId: IDS.tenant,
      landlordId: IDS.landlord,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-09-01T00:00:00.000Z"),
      monthlyRent: decision.monthlyRent,
    });
    assert(await contractStatus(client, IDS.contract) === "PENDIENTE_FIRMA", "Tras aceptar debe existir contrato PENDIENTE_FIRMA");
    step("Arrendador acepta");

    // 8) Contrato (firmas + activación municipal)
    await contracts.signPendingContract(IDS.contract, IDS.tenant);
    await contracts.signPendingContract(IDS.contract, IDS.landlord);
    assert(await contractStatus(client, IDS.contract) === "PENDIENTE_MUNICIPIO", "Tras firmas el contrato debe quedar PENDIENTE_MUNICIPIO");

    const activateAt = new Date("2026-08-17T12:00:00.000Z");
    const reserved = await reservePropertyForContractActivation(client, IDS.property, activateAt);
    assert(reserved.count === 1, "No se pudo reservar la propiedad como OCUPADO");
    await client.query(
      'UPDATE public.contracts SET status = \'ACTIVO\'::"ContractStatus","municipalReviewedAt" = $2,"municipalReviewedBy" = $3,"updatedAt" = $2 WHERE id = $1',
      [IDS.contract, activateAt, IDS.municipio],
    );
    await synchronizePropertyContractState(client, IDS.property, activateAt);
    assert(await contractStatus(client, IDS.contract) === "ACTIVO", "El contrato debe quedar ACTIVO");
    step("Contrato");

    // 9) Propiedad ocupada
    assert(await propertyStatus(client, IDS.property) === "OCUPADO", "La propiedad debe quedar OCUPADO");
    step("Propiedad ocupada");

    // 10) Crear reporte (incidencia del arrendatario sobre contrato activo)
    const activeContract = await incidents.findActiveContractForTenant(IDS.contract, IDS.tenant);
    assert(activeContract?.status === "ACTIVO", "Debe existir contrato ACTIVO para reportar incidencia");
    const incidentCreatedAt = new Date("2026-08-17T12:30:00.000Z");
    await incidents.create({
      id: IDS.incident,
      contractId: IDS.contract,
      propertyId: IDS.property,
      tenantId: IDS.tenant,
      landlordId: IDS.landlord,
      description: "Fuga de agua en cocina - E2E KAN-60",
      incidentDate: incidentCreatedAt,
      updatedAt: incidentCreatedAt,
    });
    const tenantIncidents = await incidents.list("ARRENDATARIO", IDS.tenant);
    assert(tenantIncidents.some((item) => item.id === IDS.incident && item.status === "PENDIENTE"), "El arrendatario debe ver su reporte PENDIENTE");
    step("Crear reporte");

    // 11) Resolver reporte (arrendador → RESUELTO)
    const landlordOwned = await incidents.findForLandlord(IDS.incident, IDS.landlord);
    assert(landlordOwned?.status === "PENDIENTE", "El arrendador debe poder gestionar el reporte");
    const resolvedAt = new Date("2026-08-17T12:45:00.000Z");
    const resolved = await incidents.updateStatus(IDS.incident, "RESUELTO", resolvedAt);
    assert(resolved.status === "RESUELTO", "El reporte debe quedar RESUELTO");
    step("Resolver reporte");

    // 12) Municipio ve todo (propiedad, contrato e incidencia)
    const municipalProperties = await adminProperties.listForMunicipality();
    assert(
      municipalProperties.properties.some((item) => item.id === IDS.property),
      "El municipio debe listar la propiedad",
    );
    const municipalContracts = await contracts.listForSession("MUNICIPIO", IDS.municipio);
    assert(
      municipalContracts.some((item) => item.id === IDS.contract),
      "El municipio debe listar el contrato",
    );
    const municipalIncidents = await incidents.list("MUNICIPIO", IDS.municipio);
    assert(
      municipalIncidents.some((item) => item.id === IDS.incident && item.status === "RESUELTO"),
      "El municipio debe listar la incidencia resuelta",
    );
    step("Municipio ve todo");

    // 13) Terminar contrato → propiedad DISPONIBLE
    const terminated = await finalizeContractAndSynchronizeProperty(client, {
      contractId: IDS.contract,
      propertyId: IDS.property,
      endedBy: IDS.tenant,
      now: new Date("2026-08-17T13:00:00.000Z"),
    });
    assert(terminated.finalized, "La terminación del contrato falló");
    assert(await contractStatus(client, IDS.contract) === "FINALIZADO", "El contrato debe quedar FINALIZADO");
    step("Terminar contrato");

    const finalPropertyStatus = await propertyStatus(client, IDS.property);
    assert(finalPropertyStatus === "DISPONIBLE", `Se esperaba DISPONIBLE y se obtuvo ${finalPropertyStatus}`);
    step("Propiedad vuelve disponible");

    await client.query("ROLLBACK");

    console.log("");
    console.log("KAN-60 E2E HAPPY PATH: OK");
    console.log(`steps: ${completedSteps.join(" → ")}`);
    console.log("final_property_status: DISPONIBLE");
    console.log("persistent_fixture_data: none");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "KAN-60 E2E happy path failed");
  if (completedSteps.length > 0) console.error(`completed_before_failure: ${completedSteps.join(" → ")}`);
  process.exitCode = 1;
}).finally(async () => {
  await postgres.end();
});
