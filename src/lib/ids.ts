import { randomBytes } from "node:crypto";

/** Generates a text identifier compatible with the existing String IDs. */
export function createTextId(): string {
  return `c${Date.now().toString(36)}${randomBytes(10).toString("hex")}`;
}
