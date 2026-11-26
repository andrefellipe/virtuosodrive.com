import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

/** 1 to 64 letters, digits or hyphens (rules BR1.4). */
const WELL_FORMED = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Uses the caller's request identifier if it is well formed; otherwise ignores
 * what was sent and makes one. A malformed identifier is replaced, never
 * rejected and never logged as sent.
 */
export function resolveRequestId(
  sent: string | undefined,
  generate: () => string = randomUUID,
): string {
  return sent !== undefined && WELL_FORMED.test(sent) ? sent : generate();
}
