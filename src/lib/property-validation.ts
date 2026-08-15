import { z } from "zod";

export const propertyInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  address: z.string().trim().min(3).max(240),
  monthlyRent: z.coerce.number().finite().positive().max(100000),
  bedrooms: z.coerce.number().int().min(0).max(100),
  bathrooms: z.coerce.number().int().min(0).max(100),
  description: z.string().trim().min(10).max(5000),
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  services: z.array(z.string().trim().min(1).max(80)).max(30),
  amenities: z.array(z.string().trim().min(1).max(80)).max(30),
});

export const propertyUpdateSchema = propertyInputSchema.partial().extend({
  status: z.string().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "Debes enviar al menos un campo para actualizar",
});

export function uniquePropertyLabels(values: string[]): string[] {
  return [...new Map(values.map((value) => [value.toLocaleLowerCase("es-EC"), value])).values()];
}

export function propertyCatalogSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-EC")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
