/**
 * The last defence against an email address in a log (rules BR5.4,
 * observability design O1): every entry passes through here before it is
 * written, and anything shaped like an email address, in any text field at
 * any depth, is replaced with a fixed marker.
 */

export const EMAIL_REMOVED = "[email removed]";

const EMAIL_SHAPED = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

export function removeEmailAddresses(text: string): string {
  return text.replace(EMAIL_SHAPED, EMAIL_REMOVED);
}

/** Returns a copy of the value with every text field scrubbed. */
export function scrub<T>(value: T): T {
  if (typeof value === "string") {
    return removeEmailAddresses(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => scrub(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value)) {
      copy[key] = scrub(field);
    }
    return copy as T;
  }
  return value;
}
