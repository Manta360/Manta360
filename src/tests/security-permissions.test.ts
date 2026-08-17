/**
 * KAN-61 — Suite de permisos y seguridad (API / Vitest).
 * Verifica rechazo de accesos indebidos y reglas de negocio sin crear rutas nuevas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  connect: vi.fn(),
  // properties
  listCatalogProperties: vi.fn(),
  listVerifiedIdentityDocuments: vi.fn(),
  listMineForLandlord: vi.fn(),
  findMineById: vi.fn(),
  countEffectiveContracts: vi.fn(),
  changeLandlordStatus: vi.fn(),
  updateOwnedProperty: vi.fn(),
  findOwnedForDeletion: vi.fn(),
  relatedHistoryCounts: vi.fn(),
  deleteProperty: vi.fn(),
  runPropertiesTransaction: vi.fn(),
  // contracts
  findContractById: vi.fn(),
  updatePreparation: vi.fn(),
  listContracts: vi.fn(),
  reconcileExpiredContractsWithPostgres: vi.fn(),
  // contract requests
  listRequests: vi.fn(),
  runContractRequestsTransaction: vi.fn(),
  // incidents
  listIncidents: vi.fn(),
  findActiveContractForTenant: vi.fn(),
  createIncident: vi.fn(),
  findIncidentForLandlord: vi.fn(),
  updateIncidentStatus: vi.fn(),
  // dashboard / admin / auth
  findDashboardUser: vi.fn(),
  listAdminUsers: vi.fn(),
  createLandlord: vi.fn(),
  findForLogin: vi.fn(),
  createRegisteredUser: vi.fn(),
  findPublicSessionUserById: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  createSessionToken: vi.fn(),
  setSessionCookie: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({ getActiveSession: mocks.session }));
vi.mock("@/lib/postgres-app", () => ({ applicationPostgres: { connect: mocks.connect } }));
vi.mock("@/lib/owned-property-pg", () => ({ serializeMineProperty: vi.fn(async (property: unknown) => property) }));
vi.mock("@/lib/property-catalog-pg", () => ({ serializeCatalogProperty: vi.fn(async (property: unknown) => property) }));
vi.mock("@/lib/password", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));
vi.mock("@/lib/session", () => ({
  createSessionToken: mocks.createSessionToken,
  setSessionCookie: mocks.setSessionCookie,
  getSession: mocks.getSession,
}));
vi.mock("@/repositories/properties.server", () => ({
  propertiesRepository: {
    listCatalogProperties: mocks.listCatalogProperties,
    listVerifiedIdentityDocuments: mocks.listVerifiedIdentityDocuments,
    listMineForLandlord: mocks.listMineForLandlord,
    findMineById: mocks.findMineById,
    countEffectiveContracts: mocks.countEffectiveContracts,
    changeLandlordStatus: mocks.changeLandlordStatus,
    updateOwnedProperty: mocks.updateOwnedProperty,
    findOwnedForDeletion: mocks.findOwnedForDeletion,
    relatedHistoryCounts: mocks.relatedHistoryCounts,
    deleteProperty: mocks.deleteProperty,
  },
  runPropertiesTransaction: mocks.runPropertiesTransaction,
}));
vi.mock("@/repositories/contracts.server", () => ({
  contractsRepository: {
    findById: mocks.findContractById,
    updatePreparation: mocks.updatePreparation,
    listForSession: mocks.listContracts,
  },
  reconcileExpiredContractsWithPostgres: mocks.reconcileExpiredContractsWithPostgres,
  isPostgresContractTransactionConflict: () => false,
}));
vi.mock("@/repositories/contract-requests.server", () => ({
  contractRequestsRepository: { listForSession: mocks.listRequests },
  runContractRequestsTransaction: mocks.runContractRequestsTransaction,
}));
vi.mock("@/repositories/incidents.server", () => ({
  incidentsRepository: {
    list: mocks.listIncidents,
    findActiveContractForTenant: mocks.findActiveContractForTenant,
    create: mocks.createIncident,
    findForLandlord: mocks.findIncidentForLandlord,
    updateStatus: mocks.updateIncidentStatus,
  },
}));
vi.mock("@/repositories/dashboard.server", () => ({
  dashboardRepository: { findUserById: mocks.findDashboardUser, getLandlordCounts: vi.fn(), getTenantCounts: vi.fn() },
}));
vi.mock("@/repositories/admin-users.server", () => ({
  adminUsersRepository: { listUsers: mocks.listAdminUsers, createLandlord: mocks.createLandlord },
}));
vi.mock("@/repositories/session-user.server", () => ({
  sessionUserRepository: {
    findForLogin: mocks.findForLogin,
    createRegisteredUser: mocks.createRegisteredUser,
    findPublicSessionUserById: mocks.findPublicSessionUserById,
  },
}));

import { GET as getMe } from "@/app/api/auth/me/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as getDashboard } from "@/app/api/my-dashboard/route";
import { GET as listAdminUsers } from "@/app/api/admin/users/route";
import { GET as listCatalog, POST as createProperty } from "@/app/api/properties/route";
import { DELETE as deleteProperty, GET as getProperty, PATCH as patchProperty } from "@/app/api/properties/[propertyId]/route";
import { GET as getContract, PATCH as patchContract } from "@/app/api/contracts/[id]/route";
import { POST as terminateContract } from "@/app/api/contracts/[id]/terminate/route";
import { POST as requestRenewal } from "@/app/api/contracts/[id]/renewal/route";
import { POST as createContractRequest } from "@/app/api/contract-requests/route";
import { POST as decideContractRequest } from "@/app/api/contract-requests/[id]/decision/route";
import { POST as createIncident, GET as listIncidents } from "@/app/api/incident-reports/route";
import { PATCH as patchIncident } from "@/app/api/incident-reports/[id]/route";
import { POST as municipalContractDecision } from "@/app/api/admin/contracts/[id]/decision/route";
import { PropertiesRepository } from "@/repositories/properties.repository";

const tenant = { sub: "tenant-1", email: "tenant@test.com", role: "ARRENDATARIO" as const, fullName: "Tenant" };
const landlord = { sub: "landlord-1", email: "landlord@test.com", role: "ARRENDADOR" as const, fullName: "Landlord" };
const otherLandlord = { sub: "landlord-2", email: "other@test.com", role: "ARRENDADOR" as const, fullName: "Other" };
const municipio = { sub: "municipio-1", email: "m@test.com", role: "MUNICIPIO" as const, fullName: "Municipio" };

const ownedProperty = {
  id: "property-1",
  status: "DISPONIBLE",
  approved: true,
  disableReason: null,
  title: "Depto",
  address: "Manta",
  monthlyRent: 500,
  bedrooms: 2,
  bathrooms: 1,
  description: "ok",
  latitude: -0.95,
  longitude: -80.7,
  images: [],
  services: [],
  amenities: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ownContract = {
  id: "contract-1",
  propertyId: "property-1",
  tenantId: "tenant-1",
  landlordId: "landlord-1",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-12-31"),
  status: "PENDIENTE_FIRMA",
  monthlyRent: 500,
  city: "Manta",
  province: null,
  canton: null,
  parish: null,
  neighborhood: null,
  street: null,
  houseNumber: null,
  intersection: null,
  purpose: null,
  depositAmount: null,
  paymentMethod: null,
  landlordSignedAt: null,
  tenantSignedAt: null,
  municipalReviewedAt: null,
  municipalReviewedBy: null,
  municipalReviewNotes: null,
  endedAt: null,
  endedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  properties: {
    id: "property-1",
    landlordId: "landlord-1",
    title: "Depto",
    address: "Manta",
    monthlyRent: 500,
    status: "DISPONIBLE",
    createdAt: new Date(),
    updatedAt: new Date(),
    description: null,
    bedrooms: null,
    bathrooms: null,
    latitude: null,
    longitude: null,
    createdBy: null,
    approved: true,
    approvedAt: null,
    approvedBy: null,
    disabledAt: null,
    disabledBy: null,
    disableReason: null,
  },
  users_contracts_tenantIdTousers: { id: "tenant-1", fullName: "Tenant", email: "tenant@test.com", phone: null, nationalId: null },
  users_contracts_landlordIdTousers: { id: "landlord-1", fullName: "Landlord", email: "landlord@test.com", phone: null, nationalId: null },
};

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function pg(handler: (sql: string) => { rows?: unknown[]; rowCount?: number }) {
  return {
    query: vi.fn(async (sql: string) => ({ rows: [], rowCount: 0, ...handler(sql) })),
    release: vi.fn(),
  };
}

describe("KAN-61 — permisos y seguridad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runPropertiesTransaction.mockImplementation(async (operation: (repo: unknown) => unknown) =>
      operation({
        findMineById: mocks.findMineById,
        countEffectiveContracts: mocks.countEffectiveContracts,
        changeLandlordStatus: mocks.changeLandlordStatus,
        updateOwnedProperty: mocks.updateOwnedProperty,
        findOwnedForDeletion: mocks.findOwnedForDeletion,
        relatedHistoryCounts: mocks.relatedHistoryCounts,
        deleteProperty: mocks.deleteProperty,
      }),
    );
    mocks.hashPassword.mockResolvedValue("hashed");
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.createSessionToken.mockResolvedValue("token");
    mocks.setSessionCookie.mockResolvedValue(undefined);
    mocks.reconcileExpiredContractsWithPostgres.mockResolvedValue(0);
    mocks.listCatalogProperties.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("1. Visitante accediendo a endpoints privados", () => {
    it("rechaza acciones autenticadas sin sesión (401) y admin sin token (403)", async () => {
      mocks.session.mockResolvedValue(null);
      mocks.getSession.mockResolvedValue(null);

      expect((await getDashboard()).status).toBe(401);
      expect((await listIncidents()).status).toBe(401);
      expect((await getContract(new Request("http://localhost"), { params: Promise.resolve({ id: "contract-1" }) })).status).toBe(401);
      expect((await createProperty(new Request("http://localhost", { method: "POST" }))).status).toBe(401);
      expect((await getMe()).status).toBe(401);
      expect((await listAdminUsers(new Request("http://localhost/api/admin/users"))).status).toBe(403);
      expect((await listCatalog(new Request("http://localhost/api/properties?location=Manta"))).status).toBe(403);
    });
  });

  describe("2. Arrendatario editando propiedad", () => {
    it("bloquea crear, modificar y eliminar propiedades (403)", async () => {
      mocks.session.mockResolvedValue(tenant);
      const context = { params: Promise.resolve({ propertyId: "property-1" }) };

      expect((await createProperty(new Request("http://localhost", { method: "POST" }))).status).toBe(403);
      expect((await getProperty(new Request("http://localhost"), context)).status).toBe(403);
      expect((await patchProperty(jsonRequest("http://localhost", "PATCH", { title: "Hack" }), context)).status).toBe(403);
      expect((await deleteProperty(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(403);
    });
  });

  describe("3. Arrendador editando propiedad ajena", () => {
    it("responde 404 anti-IDOR cuando la propiedad no pertenece al arrendador", async () => {
      mocks.session.mockResolvedValue(otherLandlord);
      mocks.findMineById.mockResolvedValue(null);
      mocks.findOwnedForDeletion.mockResolvedValue(null);
      const context = { params: Promise.resolve({ propertyId: "property-1" }) };

      expect((await getProperty(new Request("http://localhost"), context)).status).toBe(404);
      expect((await patchProperty(jsonRequest("http://localhost", "PATCH", { title: "Ajena" }), context)).status).toBe(404);
      expect((await deleteProperty(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(404);
    });
  });

  describe("4. Usuario registrándose como Municipio", () => {
    it("rechaza role MUNICIPIO en el registro público (400) y no persiste", async () => {
      const response = await register(
        jsonRequest("http://localhost/api/auth/register", "POST", {
          fullName: "Fake Admin",
          email: "fake@test.com",
          phone: "0991234567",
          nationalId: "1234567890",
          password: "Password1",
          role: "MUNICIPIO",
        }),
      );
      expect(response.status).toBe(400);
      expect(mocks.createRegisteredUser).not.toHaveBeenCalled();
      const body = await response.json();
      expect(body.error).toBe("Datos inválidos");
    });
  });

  describe("5. Contrato ajeno", () => {
    it("impide ver o manipular un contrato donde el usuario no es parte (404/403)", async () => {
      mocks.session.mockResolvedValue({ ...tenant, sub: "tenant-ajeno" });
      mocks.findContractById.mockResolvedValue(ownContract);

      expect((await getContract(new Request("http://localhost"), { params: Promise.resolve({ id: "contract-1" }) })).status).toBe(404);

      mocks.session.mockResolvedValue(otherLandlord);
      expect(
        (await patchContract(jsonRequest("http://localhost", "PATCH", { city: "Manta" }), { params: Promise.resolve({ id: "contract-1" }) })).status,
      ).toBe(404);

      mocks.session.mockResolvedValue(tenant);
      const termClient = pg((sql) => {
        if (sql.startsWith('SELECT id,"propertyId","tenantId"')) {
          return {
            rows: [{ id: "contract-1", propertyId: "property-1", tenantId: "tenant-otro", landlordId: "landlord-1", status: "ACTIVO" }],
            rowCount: 1,
          };
        }
        return {};
      });
      mocks.connect.mockResolvedValue(termClient);
      expect(
        (await terminateContract(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) })).status,
      ).toBe(404);
    });
  });

  describe("6. Incidencia ajena", () => {
    it("bloquea reportar o gestionar incidencias sin contrato propio activo (404/409/403)", async () => {
      mocks.session.mockResolvedValue(tenant);
      mocks.findActiveContractForTenant.mockResolvedValue(null);
      expect(
        (await createIncident(jsonRequest("http://localhost", "POST", { contractId: "contract-ajeno", description: "Problema largo suficiente" }))).status,
      ).toBe(404);

      mocks.findActiveContractForTenant.mockResolvedValue({
        id: "contract-1",
        propertyId: "property-1",
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        status: "FINALIZADO",
      });
      expect(
        (await createIncident(jsonRequest("http://localhost", "POST", { contractId: "contract-1", description: "Problema largo suficiente" }))).status,
      ).toBe(409);

      mocks.session.mockResolvedValue(otherLandlord);
      mocks.findIncidentForLandlord.mockResolvedValue(null);
      expect(
        (await patchIncident(jsonRequest("http://localhost", "PATCH", { status: "RESUELTO" }), { params: Promise.resolve({ id: "incident-1" }) })).status,
      ).toBe(404);

      mocks.session.mockResolvedValue(tenant);
      expect(
        (await patchIncident(jsonRequest("http://localhost", "PATCH", { status: "RESUELTO" }), { params: Promise.resolve({ id: "incident-1" }) })).status,
      ).toBe(403);
    });
  });

  describe("7. Renovación fuera de plazo", () => {
    it("bloquea renovación cuando faltan más de 15 días (409)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
      mocks.session.mockResolvedValue(tenant);
      mocks.connect.mockResolvedValue(
        pg((sql) =>
          sql.startsWith('SELECT id,"propertyId","tenantId"')
            ? {
                rows: [{
                  id: "contract-1",
                  propertyId: "property-1",
                  tenantId: "tenant-1",
                  startDate: new Date("2026-01-01"),
                  endDate: new Date("2026-09-30"),
                  status: "ACTIVO",
                }],
                rowCount: 1,
              }
            : {},
        ),
      );
      expect(
        (await requestRenewal(new Request("http://localhost", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "contract-1" }) })).status,
      ).toBe(409);
    });
  });

  describe("8. Propiedad ocupada", () => {
    it("rechaza operaciones no permitidas sobre una propiedad OCUPADO (409/400)", async () => {
      mocks.session.mockResolvedValue(tenant);
      mocks.runContractRequestsTransaction.mockImplementation(async (operation) =>
        operation(
          {
            propertyCanReceiveRequest: vi.fn().mockResolvedValue(false),
            isTenantIdentityReady: vi.fn().mockResolvedValue(true),
            hasPendingRequest: vi.fn().mockResolvedValue(false),
          },
          { reconcileExpiredContracts: vi.fn().mockResolvedValue(0) },
        ),
      );
      expect(
        (await createContractRequest(jsonRequest("http://localhost", "POST", { propertyId: "property-1" }))).status,
      ).toBe(409);

      mocks.session.mockResolvedValue(landlord);
      mocks.findMineById.mockResolvedValue({ ...ownedProperty, status: "OCUPADO" } as never);
      expect(
        (await patchProperty(jsonRequest("http://localhost", "PATCH", { status: "MANTENIMIENTO" }), { params: Promise.resolve({ propertyId: "property-1" }) })).status,
      ).toBe(409);
      mocks.findMineById.mockResolvedValue(ownedProperty as never);
      expect(
        (await patchProperty(jsonRequest("http://localhost", "PATCH", { status: "OCUPADO" }), { params: Promise.resolve({ propertyId: "property-1" }) })).status,
      ).toBe(400);
    });
  });

  describe("9. Propiedad inhabilitada", () => {
    it("no entra al catálogo (solo DISPONIBLE) y no permite nuevas solicitudes (409)", async () => {
      const query = vi.fn().mockResolvedValue({ rows: [] });
      await new PropertiesRepository({ query }).listCatalogProperties({ location: null, minPrice: null, maxPrice: null, services: [] });
      const sql = String(query.mock.calls[0][0]);
      expect(sql).toContain("DISPONIBLE");
      expect(sql).toContain("p.approved = true");
      expect(sql).toContain("u.active = true");
      expect(sql).not.toContain("INHABILITADO");

      mocks.session.mockResolvedValue(tenant);
      mocks.runContractRequestsTransaction.mockImplementation(async (operation) =>
        operation(
          {
            propertyCanReceiveRequest: vi.fn().mockResolvedValue(false),
            isTenantIdentityReady: vi.fn().mockResolvedValue(true),
            hasPendingRequest: vi.fn().mockResolvedValue(false),
          },
          { reconcileExpiredContracts: vi.fn().mockResolvedValue(0) },
        ),
      );
      expect(
        (await createContractRequest(jsonRequest("http://localhost", "POST", { propertyId: "property-disabled" }))).status,
      ).toBe(409);

      mocks.session.mockResolvedValue(landlord);
      mocks.findMineById.mockResolvedValue({ ...ownedProperty, status: "INHABILITADO" } as never);
      expect(
        (await patchProperty(jsonRequest("http://localhost", "PATCH", { title: "No" }), { params: Promise.resolve({ propertyId: "property-1" }) })).status,
      ).toBe(409);
    });
  });

  describe("10. Arrendador inhabilitado", () => {
    it("bloquea login (403), creación de propiedades (401 vía sesión) y aceptación de contratos (409)", async () => {
      mocks.findForLogin.mockResolvedValue({
        id: "landlord-1",
        email: "landlord@test.com",
        fullName: "Landlord",
        phone: null,
        nationalId: "1234567890",
        role: "ARRENDADOR",
        active: false,
        createdAt: new Date(),
        passwordHash: "hash",
      });
      expect(
        (await login(jsonRequest("http://localhost/api/auth/login", "POST", { identifier: "landlord@test.com", password: "Password1" }))).status,
      ).toBe(403);

      // getActiveSession ya excluye inactive → endpoints privados = 401
      mocks.session.mockResolvedValue(null);
      expect((await createProperty(new Request("http://localhost", { method: "POST" }))).status).toBe(401);

      mocks.session.mockResolvedValue(landlord);
      mocks.runContractRequestsTransaction.mockImplementation(async (operation) =>
        operation(
          {
            findForLandlordDecision: vi.fn().mockResolvedValue({
              id: "request-1",
              status: "PENDIENTE",
              propertyApproved: true,
              propertyStatus: "DISPONIBLE",
              propertyActive: false,
              propertyId: "property-1",
              tenantId: "tenant-1",
              monthlyRent: 500,
              startDate: new Date("2026-09-01"),
              endDate: new Date("2027-09-01"),
            }),
            setDecision: vi.fn(),
            hasEffectiveContract: vi.fn(),
            createPendingContract: vi.fn(),
          },
          { reconcileExpiredContracts: vi.fn().mockResolvedValue(0) },
        ),
      );
      expect(
        (await decideContractRequest(jsonRequest("http://localhost", "POST", { decision: "APROBADO" }), { params: Promise.resolve({ id: "request-1" }) })).status,
      ).toBe(409);
    });
  });

  describe("11. Contratos duplicados", () => {
    it("rechaza solapar un segundo contrato efectivo sobre la misma propiedad (409)", async () => {
      mocks.session.mockResolvedValue(municipio);
      mocks.connect.mockResolvedValue(
        pg((sql) => {
          if (sql.startsWith('SELECT id,"propertyId",status')) {
            return { rows: [{ id: "contract-2", propertyId: "property-1", status: "PENDIENTE_MUNICIPIO" }], rowCount: 1 };
          }
          if (sql.includes("JOIN public.users")) return { rowCount: 1 };
          if (sql.startsWith("SELECT 1 FROM public.contracts")) return { rowCount: 1 };
          return {};
        }),
      );
      expect(
        (await municipalContractDecision(
          jsonRequest("http://localhost", "POST", { decision: "APROBAR" }),
          { params: Promise.resolve({ id: "contract-2" }) },
        )).status,
      ).toBe(409);

      mocks.session.mockResolvedValue(landlord);
      mocks.runContractRequestsTransaction.mockImplementation(async (operation) =>
        operation(
          {
            findForLandlordDecision: vi.fn().mockResolvedValue({
              id: "request-2",
              status: "PENDIENTE",
              propertyApproved: true,
              propertyStatus: "DISPONIBLE",
              propertyActive: true,
              propertyId: "property-1",
              tenantId: "tenant-1",
              monthlyRent: 500,
              startDate: new Date("2026-09-01"),
              endDate: new Date("2027-09-01"),
            }),
            setDecision: vi.fn(),
            hasEffectiveContract: vi.fn().mockResolvedValue(true),
            createPendingContract: vi.fn(),
          },
          { reconcileExpiredContracts: vi.fn().mockResolvedValue(0) },
        ),
      );
      expect(
        (await decideContractRequest(jsonRequest("http://localhost", "POST", { decision: "APROBADO" }), { params: Promise.resolve({ id: "request-2" }) })).status,
      ).toBe(409);
    });
  });

  describe("12. Exposición de datos sensibles", () => {
    it("nunca expone passwordHash en respuestas de API relacionadas con usuarios", async () => {
      const publicUser = {
        id: "user-1",
        email: "user@test.com",
        fullName: "User",
        phone: null,
        nationalId: "1234567890",
        role: "ARRENDATARIO" as const,
        active: true,
        createdAt: new Date("2026-01-01"),
        passwordHash: "SHOULD_NOT_LEAK",
      };

      mocks.findForLogin.mockResolvedValue(publicUser);
      mocks.verifyPassword.mockResolvedValue(true);
      const loginResponse = await login(jsonRequest("http://localhost/api/auth/login", "POST", { identifier: "user@test.com", password: "Password1" }));
      expect(loginResponse.status).toBe(200);
      const loginBody = JSON.stringify(await loginResponse.json());
      expect(loginBody).not.toContain("passwordHash");
      expect(loginBody).not.toContain("SHOULD_NOT_LEAK");

      mocks.createRegisteredUser.mockResolvedValue({ ...publicUser, role: "ARRENDADOR" });
      const registerResponse = await register(
        jsonRequest("http://localhost/api/auth/register", "POST", {
          fullName: "User Name",
          email: "new@test.com",
          phone: "0991234567",
          nationalId: "0987654321",
          password: "Password1",
          role: "ARRENDADOR",
        }),
      );
      expect(registerResponse.status).toBe(201);
      expect(JSON.stringify(await registerResponse.json())).not.toContain("passwordHash");

      mocks.session.mockResolvedValue(municipio);
      mocks.listAdminUsers.mockResolvedValue([{
        id: "landlord-1",
        fullName: "Landlord",
        email: "l@test.com",
        phone: null,
        nationalId: null,
        role: "ARRENDADOR",
        active: true,
        disabledAt: null,
        disabledBy: null,
        disableReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        propertiesCount: 1,
      }]);
      const adminResponse = await listAdminUsers(new Request("http://localhost/api/admin/users"));
      expect(adminResponse.status).toBe(200);
      expect(JSON.stringify(await adminResponse.json())).not.toContain("passwordHash");

      mocks.session.mockResolvedValue(landlord);
      mocks.findMineById.mockResolvedValue(ownedProperty as never);
      const propertyResponse = await getProperty(new Request("http://localhost"), { params: Promise.resolve({ propertyId: "property-1" }) });
      expect(propertyResponse.status).toBe(200);
      expect(JSON.stringify(await propertyResponse.json())).not.toContain("passwordHash");
    });
  });
});
