import type { Queryable } from "../db/database.ts";
import { isFolderIdentifier } from "./identifiers.ts";
import { holdsVersion } from "./version-tag.ts";
import {
  readWalk,
  statementIdentifier,
  WALK_LIMIT,
  walkToTop,
} from "./walk.ts";
import type { WalkLevel } from "./walk.ts";

/**
 * Reading a folder (design W1; contract C9's getFolderView). A folder is
 * answered with one statement, or with two when the caller says it holds a
 * version (performance design P20):
 *
 *   no version sent   "everything"
 *   a version sent    "the walk"; then "everything" only if that version is
 *                     out of date
 *
 * "Everything" is one statement, so the path, the list and the version in an
 * answer are from one moment (reliability design R20). It contains the walk:
 * it finds for itself whether the folder or anything above it is deleted,
 * and never relies on a walk made a moment earlier.
 */

/** One step of the path from "All" to a folder. */
export interface PathStep {
  folderId: string;
  name: string;
}

/** One visible item as the list shows it (entities: Row; contract C3's Item). */
export type Row =
  | { itemId: string; kind: "folder"; name: string }
  | {
      itemId: string;
      kind: "file";
      name: string;
      size: number;
      contentType?: string;
    };

/** The answer to "show me this folder" (entities: FolderView). */
export interface FolderView {
  folderId: string;
  name: string;
  path: PathStep[];
  items: Row[];
}

export type FolderAnswer =
  /** Unknown, deleted, or inside a deleted folder: one answer for all three. */
  | { kind: "notFound" }
  /** The caller already holds the current version; no item was read. */
  | { kind: "unchanged"; folderId: string; version: number }
  | { kind: "folder"; view: FolderView; version: number };

/**
 * "Everything". Opens with the walk, word for word (see walk.ts). Then one
 * row: the walk's levels, and the folder's items. The items are read through
 * the index on (parent, position), which is already in the order wanted; the
 * statement itself says "not deleted", so a hidden item is never handed to
 * the server; and no item at all is read when the walk met a deleted folder.
 */
export const EVERYTHING = `
  WITH RECURSIVE walk AS (
    (
      SELECT id, parent_id, kind, name, version, deleted_at,
             size, content_type, content_id, 1 AS depth
      FROM items
      WHERE id = $1::uuid
      UNION ALL
      SELECT id, parent_id, kind, name, version, deleted_at,
             size, content_type, content_id, 1 AS depth
      FROM items
      WHERE $1::uuid IS NULL AND parent_id IS NULL
    )
    UNION ALL
    SELECT parent.id, parent.parent_id, parent.kind, parent.name, parent.version,
           parent.deleted_at, parent.size, parent.content_type, parent.content_id,
           walk.depth + 1
    FROM walk
    JOIN items AS parent ON parent.id = walk.parent_id
    WHERE walk.depth < $2::integer
  )
  SELECT
    (
      SELECT json_agg(
        json_build_object(
          'id', id, 'kind', kind, 'name', name, 'version', version,
          'is_top', parent_id IS NULL, 'is_deleted', deleted_at IS NOT NULL
        )
        ORDER BY depth
      )
      FROM walk
    ) AS levels,
    (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', item.id, 'kind', item.kind, 'name', item.name,
            'size', item.size, 'content_type', item.content_type
          )
          ORDER BY item.position
        ),
        '[]'::json
      )
      FROM items AS item
      WHERE item.parent_id = (SELECT id FROM walk WHERE depth = 1 AND kind = 'folder')
        AND item.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM walk WHERE deleted_at IS NOT NULL)
    ) AS items`;

interface ItemRecord {
  id: string;
  kind: "folder" | "file";
  name: string;
  size: number | null;
  content_type: string | null;
}

interface EverythingRow {
  levels: WalkLevel[] | null;
  items: ItemRecord[];
}

/**
 * Builds a row from the fields it names, never from a record as it comes
 * (security design S24; rules BR1.7). A column added to the table later does
 * not appear in an answer by itself: it is added here, and to the test's
 * list of allowed fields, in the same pull request.
 */
export function toRow(record: ItemRecord): Row {
  if (record.kind === "folder") {
    return { itemId: record.id, kind: "folder", name: record.name };
  }
  return {
    itemId: record.id,
    kind: "file",
    name: record.name,
    size: Number(record.size ?? 0),
    ...(record.content_type === null
      ? {}
      : { contentType: record.content_type }),
  };
}

/** Builds the folder's answer from named fields: identifier, name, path, items. */
export function toFolderView(
  levels: readonly WalkLevel[],
  items: readonly ItemRecord[],
): FolderView {
  const folder = levels[0] as WalkLevel;
  return {
    folderId: folder.id,
    name: folder.name,
    // The walk goes upwards; the path is told from the top down (rules BR1.6).
    path: levels
      .map((level) => ({ folderId: level.id, name: level.name }))
      .reverse(),
    items: items.map(toRow),
  };
}

async function readEverything(
  connection: Queryable,
  folderId: string,
): Promise<FolderAnswer> {
  const result = await connection.query<EverythingRow>(EVERYTHING, [
    statementIdentifier(folderId),
    WALK_LIMIT,
  ]);
  const row = result.rows[0];
  const levels = row?.levels ?? [];
  const folder = levels[0];
  if (
    row === undefined ||
    folder === undefined ||
    folder.kind !== "folder" ||
    !readWalk(levels)
  ) {
    return { kind: "notFound" };
  }
  return {
    kind: "folder",
    view: toFolderView(levels, row.items),
    // Always the version this statement read, never an earlier walk's.
    version: folder.version ?? 1,
  };
}

/**
 * Answers a folder (design W1). `heldVersion` is the header a caller sent
 * to say which version it holds, as it came.
 *
 * The order is fixed here and not reimplemented elsewhere (security design
 * S27): visible first, then compare versions. So a caller holding the
 * current version of a folder whose grandparent was just deleted is told
 * "not found", never "unchanged".
 */
export async function getFolderView(
  connection: Queryable,
  folderId: string,
  heldVersion?: string,
): Promise<FolderAnswer> {
  if (!isFolderIdentifier(folderId)) {
    // Not the form of an identifier: no such folder, and no statement.
    return { kind: "notFound" };
  }
  if (heldVersion !== undefined) {
    const walk = await walkToTop(connection, folderId);
    if (!walk.visible || walk.item.kind !== "folder") {
      return { kind: "notFound" };
    }
    const current = { folderId: walk.item.id, version: walk.item.version ?? 1 };
    if (holdsVersion(heldVersion, current)) {
      return { kind: "unchanged", ...current };
    }
  }
  return readEverything(connection, folderId);
}
