import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/server-auth", () => ({ getActiveSession: vi.fn() }));
vi.mock("@/repositories/identity.server", () => ({ identityRepository: { listReviewDocuments: vi.fn() }, runIdentityTransaction: vi.fn() }));
vi.mock("@/lib/identity-review-pg", () => ({ serializeReviewIdentityDocument: vi.fn(async ({ passwordHash: _passwordHash, ...document }) => document) }));
import { getActiveSession } from "@/lib/server-auth";
import { identityRepository } from "@/repositories/identity.server";
import { GET } from "@/app/api/review/identity-documents/route";
const session = vi.mocked(getActiveSession);
const document = { id: "doc-1", user: { id: "user-1", fullName: "User", email: "user@test.com" }, uploadedBy: { id: "user-1", fullName: "User", email: "user@test.com" }, documentType: "CEDULA", side: "FRENTE", originalName: "front.jpg", mimeType: "image/jpeg", fileSize: "12", verificationStatus: "PENDIENTE", uploadedAt: new Date(), reviewedAt: null, reviewNotes: null, expiresAt: null, isCurrent: true, storagePath: "private/path", passwordHash: "never" };
beforeEach(() => { vi.clearAllMocks(); session.mockResolvedValue({ sub: "municipio-1", email: "m@test.com", fullName: "Municipio", role: "MUNICIPIO" }); vi.mocked(identityRepository.listReviewDocuments).mockResolvedValue([document] as never); });
describe("GET /api/review/identity-documents", () => {
  it("permite al municipio y conserva el filtro status", async () => { const response = await GET(new Request("http://localhost/api/review/identity-documents?status=PENDIENTE")); expect(response.status).toBe(200); expect(identityRepository.listReviewDocuments).toHaveBeenCalledWith("PENDIENTE"); expect(JSON.stringify(await response.json())).not.toContain("passwordHash"); });
  it.each([[null, 401], ["ARRENDADOR", 403], ["ARRENDATARIO", 403]] as const)("preserva autorización %s", async (role, expected) => { session.mockResolvedValue(role === null ? null : { sub: "user", email: "u@test.com", fullName: "U", role }); expect((await GET(new Request("http://localhost/api/review/identity-documents"))).status).toBe(expected); });
  it("ignora status inválido como antes y no expone error SQL", async () => { vi.mocked(identityRepository.listReviewDocuments).mockRejectedValueOnce(new Error("SELECT passwordHash internal")); const response = await GET(new Request("http://localhost/api/review/identity-documents?status=NOPE")); expect(identityRepository.listReviewDocuments).toHaveBeenCalledWith(null); expect(response.status).toBe(500); await expect(response.json()).resolves.toEqual({ error: "No se pudieron cargar los documentos para revisión" }); });
});
