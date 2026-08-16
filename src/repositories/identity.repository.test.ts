import { describe, expect, it, vi } from "vitest";
import { IdentityRepository, type IdentitySqlExecutor } from "@/repositories/identity.repository";

describe("IdentityRepository", () => {
  it("filtra documentos exclusivamente por usuario y conserva el orden actual/histórico", async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [{ id: "document-1", documentType: "CEDULA", side: "FRENTE", isCurrent: true }] }) } as unknown as IdentitySqlExecutor;
    const repository = new IdentityRepository(executor);

    await expect(repository.listDocumentsForUser("user-a")).resolves.toHaveLength(1);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('WHERE "userId" = $1'), ["user-a"]);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY "isCurrent" DESC, "uploadedAt" DESC'), ["user-a"]);
    expect(executor.query).toHaveBeenCalledWith(expect.not.stringContaining("passwordHash"), ["user-a"]);
    expect(executor.query).toHaveBeenCalledWith(expect.not.stringContaining("reviewedBy"), ["user-a"]);
  });

  it("lista revisión municipal con status parametrizado y usuarios públicos explícitos", async () => {
    const executor = { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as IdentitySqlExecutor;
    const repository = new IdentityRepository(executor);
    await repository.listReviewDocuments("PENDIENTE");
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('d."verificationStatus" = $1'), ["PENDIENTE"]);
    expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY d."verificationStatus" ASC, d."uploadedAt" DESC'), ["PENDIENTE"]);
    expect(executor.query).toHaveBeenCalledWith(expect.not.stringContaining("passwordHash"), ["PENDIENTE"]);
  });
});
