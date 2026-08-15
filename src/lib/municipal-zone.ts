export const MUNICIPAL_ZONES = [
  "La Pradera",
  "Centro",
  "Alborada",
  "Tarqui",
  "Barbasquillo",
] as const;

export const UNCLASSIFIED_ZONE = "Zona no clasificada";

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-EC")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Classifies an address only when it explicitly names a maintained Manta zone.
 * It deliberately does not infer a zone from streets or other address fragments.
 */
export function getMunicipalZone(address: string | null | undefined): string {
  const normalizedAddress = normalizeForComparison(address ?? "");
  if (!normalizedAddress) return UNCLASSIFIED_ZONE;

  for (const zone of MUNICIPAL_ZONES) {
    const normalizedZone = normalizeForComparison(zone);
    const pattern = new RegExp(`\\b${escapeForRegExp(normalizedZone).replace(/ /g, "\\s+")}\\b`);
    if (pattern.test(normalizedAddress)) return zone;
  }

  return UNCLASSIFIED_ZONE;
}
