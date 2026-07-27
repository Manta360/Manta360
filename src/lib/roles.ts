export const PUBLIC_REGISTER_ROLES = ["ARRENDADOR", "ARRENDATARIO"] as const;
export const ALL_ROLES = ["ARRENDADOR", "ARRENDATARIO", "MUNICIPIO"] as const;

export type PublicRegisterRole = (typeof PUBLIC_REGISTER_ROLES)[number];
export type Role = (typeof ALL_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ARRENDADOR: "Arrendador",
  ARRENDATARIO: "Arrendatario",
  MUNICIPIO: "Municipio",
};

export const ROLE_HOME: Record<Role, string> = {
  ARRENDADOR: "/panel/arrendador",
  ARRENDATARIO: "/panel/arrendatario",
  MUNICIPIO: "/panel/municipio",
};

export function isRole(value: string): value is Role {
  return (ALL_ROLES as readonly string[]).includes(value);
}

export function isPublicRegisterRole(value: string): value is PublicRegisterRole {
  return (PUBLIC_REGISTER_ROLES as readonly string[]).includes(value);
}

export function panelPathForRole(role: Role): string {
  return ROLE_HOME[role];
}

export function roleAllowedForPath(role: Role, pathname: string): boolean {
  if (pathname.startsWith("/panel/arrendador")) return role === "ARRENDADOR";
  if (pathname.startsWith("/panel/arrendatario")) return role === "ARRENDATARIO";
  if (pathname.startsWith("/panel/municipio")) return role === "MUNICIPIO";
  if (pathname.startsWith("/panel")) return true;
  return true;
}
