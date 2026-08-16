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
});
