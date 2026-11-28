import { readFromServer } from "./call-server.ts";
import type { CallEnvironment, ReadResult } from "./call-server.ts";

/** One step of the path from "All" to a folder. */
export interface PathStep {
  folderId: string;
  name: string;
}

/** One visible item, as the list shows it (contract C3's Item). */
export interface FolderRow {
  itemId: string;
  kind: "folder" | "file";
  name: string;
  /** Files only: whole bytes. */
  size?: number;
  /** Files only, when one was recorded. */
  contentType?: string;
}

/** The answer of GET /v1/folders/{folderId} (contract C3's FolderView). */
export interface FolderAnswer {
  folderId: string;
  name: string;
  path: PathStep[];
  items: FolderRow[];
}

const isText = (value: unknown): value is string => typeof value === "string";

function parseStep(value: unknown): PathStep | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { folderId, name } = value as Record<string, unknown>;
  return isText(folderId) && folderId !== "" && isText(name)
    ? { folderId, name }
    : undefined;
}

function parseRow(value: unknown): FolderRow | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { itemId, kind, name, size, contentType } = value as Record<
    string,
    unknown
  >;
  if (
    !isText(itemId) ||
    itemId === "" ||
    (kind !== "folder" && kind !== "file") ||
    !isText(name)
  ) {
    return undefined;
  }
  return {
    itemId,
    kind,
    name,
    ...(typeof size === "number" && Number.isFinite(size) && size >= 0
      ? { size }
      : {}),
    ...(isText(contentType) ? { contentType } : {}),
  };
}

/**
 * Accepts the answer only if it has the expected fields; unknown fields are
 * ignored (contract C1), so a row that later carries "changed by" still
 * parses. Names are kept as plain text and are never interpreted.
 */
export function parseFolder(body: unknown): FolderAnswer | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const { folderId, name, path, items } = body as Record<string, unknown>;
  if (
    !isText(folderId) ||
    folderId === "" ||
    !isText(name) ||
    !Array.isArray(path) ||
    path.length === 0 ||
    !Array.isArray(items)
  ) {
    return undefined;
  }
  const steps = path.map(parseStep);
  const rows = items.map(parseRow);
  if (steps.includes(undefined) || rows.includes(undefined)) {
    return undefined;
  }
  return {
    folderId,
    name,
    path: steps as PathStep[],
    items: rows as FolderRow[],
  };
}

/**
 * Sent with every request for a folder: it tells the server that this caller
 * can read a gzip answer, which every browser can. The server compresses a
 * folder's answer only for a caller that sends it. It is a header of the
 * project's own because the browser's standard one does not reach the
 * server (the edge is not allowed to pass it on). The browser unpacks a
 * compressed answer by itself, so nothing else in the page knows of this.
 * The call is to the page's own address, so the extra header causes no
 * request of its own to ask permission first.
 */
export const ACCEPTS_GZIP: Readonly<Record<string, string>> = {
  "X-Accept-Gzip": "1",
};

/**
 * Asks the server for a folder: `root` for "All", or a folder's identifier.
 * With the version held, the outcome may be "unchanged" (design W3).
 */
export function readFolder(
  folderId: string,
  heldVersion?: string,
  environment?: CallEnvironment,
): Promise<ReadResult<FolderAnswer>> {
  return readFromServer(
    `/v1/folders/${encodeURIComponent(folderId)}`,
    parseFolder,
    environment,
    {
      headers: ACCEPTS_GZIP,
      ...(heldVersion === undefined ? {} : { heldVersion }),
    },
  );
}
