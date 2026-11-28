import type { PathStep } from "../api/folder.ts";

/**
 * Which folder the page's address names, and the address for a folder
 * (decision T22; rules BR3.1). The browser's own history functions are used
 * directly; there is no routing library. An address is the plain one, "/",
 * for "All", or carries one folder identifier: "/folders/<identifier>".
 * Names never appear in an address.
 */

/** The identifier that means the top folder, "All". */
export const ROOT = "root";

/** What the breadcrumb shows before any answer has arrived. */
export const TOP_STEP: PathStep = { folderId: ROOT, name: "All" };

const FOLDER_ADDRESS = /^\/folders\/([^/]+)\/?$/;

/**
 * The folder an address names: `root` when it names none. What follows
 * "/folders/" is passed on as it is; whether it is a folder is the server's
 * to say.
 */
export function folderFromAddress(pathname: string): string {
  const found = FOLDER_ADDRESS.exec(pathname)?.[1];
  if (found === undefined) {
    return ROOT;
  }
  try {
    return decodeURIComponent(found);
  } catch {
    return found;
  }
}

/** The address of a folder. "All" has one address, the plain one. */
export function addressOf(folderId: string): string {
  return folderId === ROOT ? "/" : `/folders/${encodeURIComponent(folderId)}`;
}

/**
 * The steps of the path that were known when an address was written, kept
 * with the history entry so that back and forward can show them at once.
 * Anything not of that shape is ignored.
 */
export function knownPath(state: unknown): PathStep[] | undefined {
  const steps = (state as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    return undefined;
  }
  const known: PathStep[] = [];
  for (const step of steps as unknown[]) {
    const { folderId, name } = (step ?? {}) as Record<string, unknown>;
    if (typeof folderId !== "string" || typeof name !== "string") {
      return undefined;
    }
    known.push({ folderId, name });
  }
  return known;
}

/** A new history entry for a folder that is being opened. */
export function pushAddress(folderId: string, steps: PathStep[]): void {
  window.history.pushState({ steps }, "", addressOf(folderId));
}

/**
 * Replaces the address without a new history entry: used when the page was
 * opened with the top folder's own identifier, which is never left in the
 * address.
 */
export function replaceAddress(folderId: string, steps: PathStep[]): void {
  window.history.replaceState({ steps }, "", addressOf(folderId));
}
