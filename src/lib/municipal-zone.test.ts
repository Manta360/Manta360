import { describe, expect, it } from "vitest";
import { UNCLASSIFIED_ZONE, getMunicipalZone } from "@/lib/municipal-zone";

describe("getMunicipalZone", () => {
  it.each([
    ["La Pradera", "La Pradera"],
    ["la pradera", "La Pradera"],
    ["Sector LA   PRADERA, Manta", "La Pradera"],
    ["CÉNTRO de Manta", "Centro"],
    ["Residencia en Barbasquillo", "Barbasquillo"],
    ["Tarqui, cerca del malecón", "Tarqui"],
  ])("classifies %s as %s", (address, expectedZone) => {
    expect(getMunicipalZone(address)).toBe(expectedZone);
  });

  it.each(["Av. Flavio Reyes", "", "   ", "Dirección sin sector conocido", undefined, null])(
    "does not infer a zone from %s",
    (address) => {
      expect(getMunicipalZone(address)).toBe(UNCLASSIFIED_ZONE);
    },
  );
});
