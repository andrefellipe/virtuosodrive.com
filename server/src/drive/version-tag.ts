/**
 * The version a caller holds (security design S21; rules BR1.8). The server
 * issues it as a quoted text made of the folder's identifier and its version
 * number, so a version of one folder never matches another. To the caller it
 * is opaque.
 */

/** A header longer than this is not read at all. */
export const VERSION_TAG_LIMIT = 128;

const ISSUED_FORM =
  /^"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([1-9][0-9]{0,9})"$/;

/** A part on the way may mark the version as weak when it changes the encoding. */
const WEAK_MARKER = "W/";

export interface FolderVersion {
  folderId: string;
  version: number;
}

/** The quoted version sent with a folder's answer. */
export function makeVersionTag(folderId: string, version: number): string {
  return `"${folderId}.${version}"`;
}

/**
 * Reads back a version this server could have issued. Anything else is
 * "holds none": a missing or over-long value, a malformed one, and a list of
 * several versions, which is not supported.
 */
export function readVersionTag(
  header: string | undefined,
): FolderVersion | undefined {
  if (header === undefined || header.length > VERSION_TAG_LIMIT) {
    return undefined;
  }
  const value = header.startsWith(WEAK_MARKER)
    ? header.slice(WEAK_MARKER.length)
    : header;
  const issued = ISSUED_FORM.exec(value);
  if (issued === null) {
    return undefined;
  }
  return { folderId: issued[1] as string, version: Number(issued[2]) };
}

/**
 * Whether the caller holds exactly the folder's current version. A version
 * of another folder is "holds none".
 */
export function holdsVersion(
  header: string | undefined,
  current: FolderVersion,
): boolean {
  const held = readVersionTag(header);
  return (
    held !== undefined &&
    held.folderId === current.folderId &&
    held.version === current.version
  );
}
