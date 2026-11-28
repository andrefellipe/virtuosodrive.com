import type { Queryable } from "../db/database.ts";
import { ROOT_FOLDER } from "./identifiers.ts";
import { PathTooDeepError } from "./store-errors.ts";

/**
 * "The walk" (performance design P20): one statement that follows parents
 * from an item up to the top folder, inside the database. It reads at most
 * WALK_LIMIT rows, each by its identifier, however large the table is.
 *
 * The same recursive part opens the statement that answers a whole folder
 * (folder-reading.ts), so both decide "is this visible" the same way.
 */

/** The most levels a walk follows (security design S26). */
export const WALK_LIMIT = 64;

/**
 * The recursive part comes first: the item asked for (or, when no identifier
 * is given, the top folder) at depth 1, then each parent in turn. $1 is the
 * identifier or null, $2 the limit. The statement that answers a whole
 * folder opens with the same part, word for word; a test compares the two,
 * because the statements are fixed texts and are not assembled from pieces.
 */
export const THE_WALK = `
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
  SELECT id, kind, name, version, size, content_type, content_id,
         parent_id IS NULL AS is_top,
         deleted_at IS NOT NULL AS is_deleted
  FROM walk
  ORDER BY depth`;

/** The recursive part of a statement that opens with the walk: up to the line that closes it. */
export function recursivePart(statement: string): string {
  const end = statement.indexOf("\n  )\n");
  if (end === -1) {
    throw new Error("The statement does not open with the walk");
  }
  return statement.slice(0, end);
}

/** One level of a walk, the item asked for first. */
export interface WalkLevel {
  id: string;
  kind: "folder" | "file";
  name: string;
  /** A folder's version; null for a file. */
  version: number | null;
  /** Whether this is the top folder. */
  is_top: boolean;
  is_deleted: boolean;
}

interface WalkRow extends WalkLevel {
  size: string | null;
  content_type: string | null;
  content_id: string | null;
}

export interface WalkedItem extends WalkLevel {
  /** A file's own fields; null for a folder. */
  size: number | null;
  contentType: string | null;
  contentId: string | null;
}

export type Walk =
  /** No such item, or it or something above it is deleted: not to be told apart. */
  | { visible: false }
  | {
      visible: true;
      /** The item asked for. */
      item: WalkedItem;
      /** The folders from the top down to the item's folder (or to the item, if it is a folder). */
      path: { folderId: string; name: string }[];
    };

/** The identifier as the statements take it: null stands for the top folder. */
export function statementIdentifier(folderId: string): string | null {
  return folderId === ROOT_FOLDER ? null : folderId;
}

/**
 * Whether a walk's levels show a visible item (also used on the levels the
 * full statement returns). Checks, in this order: found at all; nothing
 * deleted on the way; the top reached within the limit, which is a fault
 * when it is not.
 */
export function readWalk(levels: readonly WalkLevel[]): boolean {
  const first = levels[0];
  if (first === undefined || levels.some((level) => level.is_deleted)) {
    return false;
  }
  if (levels.at(-1)?.is_top !== true) {
    // The walk stopped before the top: at its limit, or the data is damaged.
    throw new PathTooDeepError(first.id, WALK_LIMIT);
  }
  return true;
}

/**
 * Walks from the item to the top. The identifier must already be known to be
 * `root` or of the generated form.
 */
export async function walkToTop(
  connection: Queryable,
  itemId: string,
): Promise<Walk> {
  const result = await connection.query<WalkRow>(THE_WALK, [
    statementIdentifier(itemId),
    WALK_LIMIT,
  ]);
  if (!readWalk(result.rows)) {
    return { visible: false };
  }
  const first = result.rows[0] as WalkRow;
  return {
    visible: true,
    item: {
      id: first.id,
      kind: first.kind,
      name: first.name,
      version: first.version,
      is_top: first.is_top,
      is_deleted: first.is_deleted,
      size: first.size === null ? null : Number(first.size),
      contentType: first.content_type,
      contentId: first.content_id,
    },
    path: result.rows
      .filter((level) => level.kind === "folder")
      .map((level) => ({ folderId: level.id, name: level.name }))
      .reverse(),
  };
}
