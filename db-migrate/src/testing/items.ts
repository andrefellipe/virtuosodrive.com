import type { ClientBase } from "pg";

/**
 * Writes straight to the `items` table, for tests only: to set a folder up
 * for a test, and to try to break a rule the table holds. Nothing outside
 * tests writes this way; the code goes through the change step.
 */

export interface DirectItem {
  kind: "folder" | "file";
  /** The folder it is in. Null only when a test tries to make a second top folder. */
  parentId: string | null;
  name: string;
  /** Left out: the next free place in the parent. */
  position?: number | null;
  /** Left out: 1 for a folder, none for a file. */
  version?: number | null;
  /** Left out: none for a folder, 0 for a file. */
  size?: number | null;
  contentType?: string | null;
  /** Marks the item deleted now. */
  deleted?: boolean;
  /** Left out: "deleted" for a deleted file, none otherwise. */
  deletedReason?: string | null;
  sourceKey?: string | null;
}

const INSERT_ITEM = `
  INSERT INTO items (
    kind, parent_id, name, position, version, size, content_type,
    deleted_at, deleted_reason, source_key
  )
  VALUES (
    $1, $2, $3,
    CASE WHEN $4::boolean THEN $5::integer
         ELSE (SELECT COALESCE(MAX(position), 0) + 1 FROM items WHERE parent_id = $2) END,
    $6, $7, $8,
    CASE WHEN $9::boolean THEN now() END,
    $10, $11
  )
  RETURNING id`;

/** Inserts one row as given, with no rule applied but the table's own. Answers its identifier. */
export async function insertItemDirectly(
  client: ClientBase,
  item: DirectItem,
): Promise<string> {
  const isFile = item.kind === "file";
  const deleted = item.deleted === true;
  const result = await client.query<{ id: string }>(INSERT_ITEM, [
    item.kind,
    item.parentId,
    item.name,
    "position" in item,
    item.position ?? null,
    "version" in item ? item.version : isFile ? null : 1,
    "size" in item ? item.size : isFile ? 0 : null,
    item.contentType ?? null,
    deleted,
    "deletedReason" in item
      ? item.deletedReason
      : isFile && deleted
        ? "deleted"
        : null,
    item.sourceKey ?? null,
  ]);
  return (result.rows[0] as { id: string }).id;
}

/** The identifier of the top folder, "All". */
export async function topFolderId(client: ClientBase): Promise<string> {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM items WHERE parent_id IS NULL",
  );
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error("The items table has no top folder");
  }
  return row.id;
}

/** A new, empty folder inside the given one, for a test to work in. */
export function insertFolder(
  client: ClientBase,
  parentId: string,
  name: string,
): Promise<string> {
  return insertItemDirectly(client, { kind: "folder", parentId, name });
}

/** Marks an item deleted, as a later Unit's delete will. */
export async function markDeleted(
  client: ClientBase,
  itemId: string,
): Promise<void> {
  await client.query(
    "UPDATE items SET deleted_at = now(), deleted_reason = CASE WHEN kind = 'file' THEN 'deleted' END WHERE id = $1",
    [itemId],
  );
}
