import { describe, expect, it } from "vitest";
import { registerSchema, toPublicUser } from "@/lib/validations/auth";
import { isPublicRegisterRole, roleAllowedForPath } from "@/lib/roles";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("KAN-10 / US01 — registro", () => {
  it("exige rol Arrendador o Arrendatario", () => {
    const result = registerSchema.safeParse({
      fullName: "Ana Pérez",
      email: "ana@example.com",
      password: "claveSegura1",
      role: "MUNICIPIO",
    });

    expect(result.success).toBe(false);
    expect(isPublicRegisterRole("MUNICIPIO")).toBe(false);
    expect(isPublicRegisterRole("ARRENDADOR")).toBe(true);
  });

  it("valida datos básicos del formulario", () => {
    const ok = registerSchema.safeParse({
      fullName: "Luis Mora",
      email: "Luis@Example.COM",
      phone: "0987654321",
      password: "segura123",
      role: "ARRENDATARIO",
    });

    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.email).toBe("luis@example.com");
      expect(ok.data.role).toBe("ARRENDATARIO");
    }

    const bad = registerSchema.safeParse({
      fullName: "Li",
      email: "no-es-correo",
      password: "corta",
      role: "ARRENDADOR",
    });
    expect(bad.success).toBe(false);
  });

  it("encripta contraseñas y nunca expone el hash en el usuario público", async () => {
    const hash = await hashPassword("segura123");
    expect(hash).not.toBe("segura123");
    expect(await verifyPassword("segura123", hash)).toBe(true);

    const publicUser = toPublicUser({
      id: "u1",
      email: "a@b.com",
      fullName: "A",
      phone: null,
      role: "ARRENDADOR",
      active: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(publicUser).not.toHaveProperty("passwordHash");
    expect(publicUser.email).toBe("a@b.com");
  });

  it("bloquea paneles de otros roles", () => {
    expect(roleAllowedForPath("ARRENDADOR", "/panel/municipio")).toBe(false);
    expect(roleAllowedForPath("ARRENDATARIO", "/panel/arrendatario")).toBe(true);
    expect(roleAllowedForPath("MUNICIPIO", "/panel/municipio")).toBe(true);
  });
});
