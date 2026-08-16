import { z } from "zod";

export const incidentStatuses = ["PENDIENTE", "EN_PROCESO", "RESUELTO"] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];

export const contractDateFields = {
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
};

export function isValidDate(value: Date) {
  return Number.isFinite(value.getTime());
}

export function hasValidContractDateRange(startDate: Date, endDate: Date) {
  return isValidDate(startDate) && isValidDate(endDate) && endDate.getTime() > startDate.getTime();
}

export function hasValidProvidedContractDateRange(startDate?: string, endDate?: string) {
  return !startDate || !endDate || hasValidContractDateRange(new Date(startDate), new Date(endDate));
}

export function isWithinRenewalWindow(endDate: Date, now = new Date()) {
  if (!isValidDate(endDate)) return false;
  const remainingDays = (endDate.getTime() - now.getTime()) / 86_400_000;
  return remainingDays >= 0 && remainingDays <= 15;
}

const incidentTransitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  PENDIENTE: ["EN_PROCESO", "RESUELTO"],
  EN_PROCESO: ["RESUELTO"],
  RESUELTO: [],
};

export function canTransitionIncidentStatus(from: string, to: string) {
  if (!incidentStatuses.includes(from as IncidentStatus) || !incidentStatuses.includes(to as IncidentStatus)) return false;
  return incidentTransitions[from as IncidentStatus].includes(to as IncidentStatus);
}
