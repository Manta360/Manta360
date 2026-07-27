"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PUBLIC_REGISTER_ROLES, ROLE_LABELS } from "@/lib/roles";

type FieldErrors = Partial<Record<string, string[]>>;

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const payload = {
      fullName: String(form.get("fullName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      password: String(form.get("password") ?? ""),
      role: String(form.get("role") ?? ""),
    };

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "No se pudo registrar");
      setFieldErrors(data.details ?? {});
      return;
    }

    router.push(data.redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field
        label="Nombre completo"
        name="fullName"
        autoComplete="name"
        required
        errors={fieldErrors.fullName}
      />
      <Field
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={fieldErrors.email}
      />
      <Field
        label="Teléfono (opcional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        errors={fieldErrors.phone}
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        errors={fieldErrors.password}
        hint="Mínimo 8 caracteres, con letras y números"
      />

      <fieldset className="space-y-2">
        <legend className="text-sm text-sand/80">
          Rol <span className="text-coral">*</span>
        </legend>
        <p className="text-xs text-sand/60">
          Obligatorio. El rol Municipio no está disponible en el registro público.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PUBLIC_REGISTER_ROLES.map((role) => (
            <label
              key={role}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--line)] bg-white/5 px-4 py-3 transition hover:bg-white/10 has-[:checked]:border-sea has-[:checked]:bg-sea/20"
            >
              <input
                type="radio"
                name="role"
                value={role}
                required
                className="accent-[var(--sea)]"
              />
              <span>{ROLE_LABELS[role]}</span>
            </label>
          ))}
        </div>
        {fieldErrors.role?.[0] ? (
          <p className="text-sm text-coral">{fieldErrors.role[0]}</p>
        ) : null}
      </fieldset>

      {error ? <p className="text-sm text-coral">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-sea px-5 py-3 font-semibold text-foam transition hover:bg-sea-deep disabled:opacity-60"
      >
        {loading ? "Creando cuenta..." : "Crear cuenta"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  autoComplete,
  errors,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  errors?: string[];
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-sand/80">
        {label}
        {required ? <span className="text-coral"> *</span> : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-[var(--line)] bg-[#0c171e]/px-4 py-3 outline-none ring-sea focus:ring-2"
      />
      {hint ? <span className="block text-xs text-sand/55">{hint}</span> : null}
      {errors?.[0] ? <span className="block text-sm text-coral">{errors[0]}</span> : null}
    </label>
  );
}
