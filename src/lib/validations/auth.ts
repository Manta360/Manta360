import { z } from "zod";
import { PUBLIC_REGISTER_ROLES } from "@/lib/roles";

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(120, "El nombre es demasiado largo"),
  email: z
    .string()
    .trim()
    .email("Correo electrónico inválido")
    .max(160, "El correo es demasiado largo")
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine(
      (value) => value === undefined || (value.length >= 7 && value.length <= 20),
      "Teléfono inválido",
    ),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña es demasiado larga")
    .regex(/[A-Za-z]/, "La contraseña debe incluir al menos una letra")
    .regex(/[0-9]/, "La contraseña debe incluir al menos un número"),
  role: z.enum(PUBLIC_REGISTER_ROLES, {
    error: "Debes seleccionar Arrendador o Arrendatario",
  }),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Correo electrónico inválido")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Campos seguros para exponer al cliente (nunca passwordHash). */
export function toPublicUser(user: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  active: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
  };
}
