import type {
  Queryable,
  TransactionConnection,
  Transactions,
} from "../db/database.ts";
import {
  isFolderIdentifier,
  isItemIdentifier,
  ROOT_FOLDER,
} from "./identifiers.ts";
import { checkNameForm, numberedName } from "./names.ts";
import type { NameProblem } from "./names.ts";
import {
  FolderBusyError,
  isDuplicateName,
  isLockTimeout,
  isStoreRefusal,
  StoreRefusedError,
} from "./store-errors.ts";
import { walkToTop } from "./walk.ts";

/**
 * The one way to change a folder's list (design W7; reliability design R21),
 * and the name operations of contract C9 (design W5).
 *
 * The change step is one database transaction:
 *
 *   1. Lock the folder's row. A second change to the same folder waits here.
 *   2. Walk from the folder to the top; "not found" if anything is deleted.
 *   3. Check the name, or work out the lowest free one.
 *   4. Take the next position: one more than the highest in the folder,
 *      deleted items included.
 *   5. Write the item.
 *   6. Add one to the folder's version.
 *
 * Any failure rolls everything back: nothing was changed.
 *
 * In U3 no route reaches any of this (security design S25). The only caller
 * is the sample loader, on the change runner's own connection. U6, U7 and U8
 * call it; none compares names or takes a position itself.
 */

/** Why a change, or a name, was refused: for the caller to turn into its own answer. */
export type ChangeRefusal = "notFound" | NameProblem | "nameAlreadyUsed";

export type NameCheck =
  { ok: true; name: string } | { ok: false; refusal: ChangeRefusal };

/** What to do when the name is already used in the folder. */
export type WhenNameIsTaken = "refuse" | "keepBoth";

export interface NewItem {
  /** The folder the item goes into: `root`, or a folder's identifier. */
  folderId: string;
  kind: "folder" | "file";
  /** As a person sent it; it is normalised and validated here. */
  name: string;
  /** Default: refuse. "keepBoth" gives the item the lowest free numbered name. */
  whenNameIsTaken?: WhenNameIsTaken;
  /** A file's size in whole bytes. Left out for a folder. */
  size?: number;
  contentType?: string | null;
  /** Where a loader's item came from, so that loading again finds it. */
  sourceKey?: string;
  /**
   * Creates the item and marks it deleted in the same step, raising the
   * folder's version once more. Only prepared sample content uses this.
   */
  markDeleted?: boolean;
  /**
   * For a new folder: items created inside it in the same step, in order,
   * before any deletion mark is set. So a folder that is to be deleted can
   * be given what it holds, which could not be added once it is hidden.
   * Only prepared sample content uses this. If any of them is refused, the
   * whole step is refused and nothing is changed.
   */
  contents?: readonly ContentItem[];
}

/** An item created inside a new folder, with that folder. */
export type ContentItem = Omit<NewItem, "folderId">;

export type AddItemResult =
  | {
      ok: true;
      itemId: string;
      /** The name as stored. */
      name: string;
      position: number;
      /** The folder's own identifier (never `root`). */
      folderId: string;
      /** The folder's version after the change. */
      folderVersion: number;
      /** How many items the step wrote: 1, and more for a folder created with contents. */
      itemsWritten: number;
    }
  | { ok: false; refusal: ChangeRefusal };

/** The longest a change waits for its folder (reliability design R21). */
export const FOLDER_WAIT_LIMIT_MS = 2_000;
/** What a change keeps of its deadline for the work after the wait. */
export const FOLDER_WAIT_RESERVE_MS = 500;
/** How many numbered names are tried in one question to the database. */
const CANDIDATES_PER_QUESTION = 50;
/** Far more numbered names than a folder can sensibly hold. */
const MOST_QUESTIONS = 200;

const SET_WAIT = "SELECT set_config('lock_timeout', $1, true)";
const LOCK_FOLDER =
  "SELECT id FROM items WHERE id = $1::uuid AND kind = 'folder' FOR UPDATE";
const LOCK_TOP_FOLDER =
  "SELECT id FROM items WHERE parent_id IS NULL FOR UPDATE";

/**
 * "Is there an item not deleted in this folder whose key equals the key of
 * this text": the text is a parameter and the database folds it, with the
 * same rules that make the stored key (security design S23; decision T26).
 */
const NAME_IS_TAKEN = `
  SELECT EXISTS (
    SELECT 1
    FROM items
    WHERE parent_id = $1::uuid
      AND deleted_at IS NULL
      AND name_key = casefold($2::text COLLATE "pg_c_utf8")
      AND ($3::uuid IS NULL OR id <> $3::uuid)
  ) AS taken`;

/** The first of the candidate names, in the order given, that no item not deleted has. */
const FIRST_FREE_NAME = `
  SELECT candidate.name
  FROM unnest($2::text[]) WITH ORDINALITY AS candidate (name, place)
  WHERE NOT EXISTS (
    SELECT 1
    FROM items
    WHERE parent_id = $1::uuid
      AND deleted_at IS NULL
      AND name_key = casefold(candidate.name COLLATE "pg_c_utf8")
  )
  ORDER BY candidate.place
  LIMIT 1`;

const NEXT_POSITION =
  "SELECT COALESCE(MAX(position), 0) + 1 AS next FROM items WHERE parent_id = $1::uuid";

const WRITE_ITEM = `
  INSERT INTO items (kind, parent_id, name, position, version, size, content_type, source_key)
  VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8)
  RETURNING id`;

const MARK_DELETED =
  "UPDATE items SET deleted_at = now(), deleted_reason = $2 WHERE id = $1::uuid";

const RAISE_VERSION =
  "UPDATE items SET version = version + 1 WHERE id = $1::uuid RETURNING version";

/**
 * Thrown inside the step, once something has been written, so that the whole
 * transaction is rolled back. It never leaves this module: addItem turns it
 * into the refusal it carries.
 */
class RefusedAfterWriting extends Error {
  readonly refusal: ChangeRefusal;

  constructor(refusal: ChangeRefusal) {
    super(`The change was refused after its first write: ${refusal}`);
    this.name = "RefusedAfterWriting";
    this.refusal = refusal;
  }
}

async function isTaken(
  connection: Queryable,
  folderId: string,
  name: string,
  ignoreItemId: string | null,
): Promise<boolean> {
  const result = await connection.query<{ taken: boolean }>(NAME_IS_TAKEN, [
    folderId,
    name,
    ignoreItemId,
  ]);
  return result.rows[0]?.taken === true;
}

async function firstFreeNumberedName(
  connection: Queryable,
  folderId: string,
  name: string,
): Promise<string> {
  for (let question = 0; question < MOST_QUESTIONS; question += 1) {
    const from = question * CANDIDATES_PER_QUESTION + 1;
    const candidates = Array.from(
      { length: CANDIDATES_PER_QUESTION },
      (_unused, index) => numberedName(name, from + index),
    );
    const result = await connection.query<{ name: string }>(FIRST_FREE_NAME, [
      folderId,
      candidates,
    ]);
    const free = result.rows[0]?.name;
    if (free !== undefined) {
      return free;
    }
  }
  throw new Error(
    `No free numbered name was found in folder ${folderId} among ${MOST_QUESTIONS * CANDIDATES_PER_QUESTION}`,
  );
}

/** The folder's own identifier if it is visible; undefined if it is not. */
async function visibleFolderId(
  connection: Queryable,
  folderId: string,
): Promise<string | undefined> {
  if (!isFolderIdentifier(folderId)) {
    return undefined;
  }
  const walk = await walkToTop(connection, folderId);
  return walk.visible && walk.item.kind === "folder" ? walk.item.id : undefined;
}

/**
 * Applies the name rules for a folder (contract C9, checkName; design W5).
 * Made on its own, this is only advice, good for showing a message early: a
 * second caller can take the name before it is used. What counts is the
 * same check made again inside the change step.
 */
export async function checkName(
  connection: Queryable,
  input: { folderId: string; name: string; ignoreItemId?: string | null },
): Promise<NameCheck> {
  // The folder first, before the name is looked at (rules BR2.12).
  const folderId = await visibleFolderId(connection, input.folderId);
  if (folderId === undefined) {
    return { ok: false, refusal: "notFound" };
  }
  const form = checkNameForm(input.name);
  if (!form.ok) {
    return { ok: false, refusal: form.problem };
  }
  const ignore = isItemIdentifier(input.ignoreItemId)
    ? input.ignoreItemId
    : null;
  if (await isTaken(connection, folderId, form.name, ignore)) {
    return { ok: false, refusal: "nameAlreadyUsed" };
  }
  return { ok: true, name: form.name };
}

/**
 * The name itself if it is free in the folder, otherwise the lowest free
 * numbered name (contract C9, lowestFreeName; rules BR2.7). Advice when
 * called on its own, as checkName is.
 */
export async function lowestFreeName(
  connection: Queryable,
  input: { folderId: string; name: string },
): Promise<NameCheck> {
  const folderId = await visibleFolderId(connection, input.folderId);
  if (folderId === undefined) {
    return { ok: false, refusal: "notFound" };
  }
  const form = checkNameForm(input.name);
  if (!form.ok) {
    return { ok: false, refusal: form.problem };
  }
  if (!(await isTaken(connection, folderId, form.name, null))) {
    return { ok: true, name: form.name };
  }
  return {
    ok: true,
    name: await firstFreeNumberedName(connection, folderId, form.name),
  };
}

/** The wait allowed for the folder: 2 seconds, or what is left of the deadline less half a second. */
export function folderWaitMs(remainingMs: number | undefined): number {
  if (remainingMs === undefined) {
    return FOLDER_WAIT_LIMIT_MS;
  }
  return Math.max(
    1,
    Math.min(
      FOLDER_WAIT_LIMIT_MS,
      Math.floor(remainingMs) - FOLDER_WAIT_RESERVE_MS,
    ),
  );
}

async function lockFolder(
  connection: TransactionConnection,
  folderId: string,
): Promise<string | undefined> {
  // Set on the transaction itself, so the limit cannot outlive it.
  await connection.query(SET_WAIT, [
    `${folderWaitMs(connection.remainingMs())}ms`,
  ]);
  try {
    const locked =
      folderId === ROOT_FOLDER
        ? await connection.query<{ id: string }>(LOCK_TOP_FOLDER)
        : await connection.query<{ id: string }>(LOCK_FOLDER, [folderId]);
    return locked.rows[0]?.id;
  } catch (error) {
    if (isLockTimeout(error)) {
      throw new FolderBusyError(folderId);
    }
    throw error;
  }
}

/** Steps 5 and 6, with the database's refusals told apart by the name of the rule. */
async function writeItem(
  connection: TransactionConnection,
  folderId: string,
  item: NewItem,
  name: string,
  position: number,
): Promise<{ itemId: string; folderVersion: number }> {
  const isFile = item.kind === "file";
  try {
    const written = await connection.query<{ id: string }>(WRITE_ITEM, [
      item.kind,
      folderId,
      name,
      position,
      isFile ? null : 1,
      isFile ? (item.size ?? 0) : null,
      isFile ? (item.contentType ?? null) : null,
      item.sourceKey ?? null,
    ]);
    const itemId = (written.rows[0] as { id: string }).id;
    const raised = await connection.query<{ version: number }>(RAISE_VERSION, [
      folderId,
    ]);
    return {
      itemId,
      folderVersion: (raised.rows[0] as { version: number }).version,
    };
  } catch (error) {
    if (isDuplicateName(error)) {
      // The store's own refusal of a duplicate name: the only store refusal
      // reported as a name problem (rules BR2.11).
      throw new RefusedAfterWriting("nameAlreadyUsed");
    }
    if (isStoreRefusal(error)) {
      // Deliberately without the database's error: its message can quote a name.
      throw new StoreRefusedError(folderId, error);
    }
    throw error;
  }
}

/** Marks a just-created item deleted, and raises its folder's version once more. */
async function markDeleted(
  connection: TransactionConnection,
  folderId: string,
  itemId: string,
  isFile: boolean,
): Promise<number> {
  await connection.query(MARK_DELETED, [itemId, isFile ? "deleted" : null]);
  // The list changed a second time: the item is gone from it again.
  const raised = await connection.query<{ version: number }>(RAISE_VERSION, [
    folderId,
  ]);
  return (raised.rows[0] as { version: number }).version;
}

/**
 * The change step's work, inside the transaction. A refusal found before
 * anything is written is answered. One found after something was written (a
 * new folder's contents, or the database's own refusal of a duplicate name)
 * is thrown, so that the transaction is rolled back; addItem answers it.
 */
async function addItemWithin(
  connection: TransactionConnection,
  item: NewItem,
): Promise<AddItemResult> {
  if (!isFolderIdentifier(item.folderId)) {
    return { ok: false, refusal: "notFound" };
  }
  // 1. Hold the folder.
  const folderId = await lockFolder(connection, item.folderId);
  if (folderId === undefined) {
    return { ok: false, refusal: "notFound" };
  }
  // 2. Still visible?
  if ((await visibleFolderId(connection, folderId)) === undefined) {
    return { ok: false, refusal: "notFound" };
  }
  // 3. The name, or the lowest free one.
  const form = checkNameForm(item.name);
  if (!form.ok) {
    return { ok: false, refusal: form.problem };
  }
  let name = form.name;
  if (await isTaken(connection, folderId, name, null)) {
    if (item.whenNameIsTaken !== "keepBoth") {
      return { ok: false, refusal: "nameAlreadyUsed" };
    }
    name = await firstFreeNumberedName(connection, folderId, name);
  }
  // 4. The next position.
  const next = await connection.query<{ next: number }>(NEXT_POSITION, [
    folderId,
  ]);
  const position = (next.rows[0] as { next: number }).next;
  // 5 and 6. Write, and raise the version.
  const written = await writeItem(connection, folderId, item, name, position);
  let { folderVersion } = written;
  let itemsWritten = 1;
  // What a new folder holds from the start, each through these same steps.
  for (const content of item.contents ?? []) {
    const inside = await addItemWithin(connection, {
      ...content,
      folderId: written.itemId,
    });
    if (!inside.ok) {
      throw new RefusedAfterWriting(inside.refusal);
    }
    itemsWritten += inside.itemsWritten;
  }
  if (item.markDeleted === true) {
    folderVersion = await markDeleted(
      connection,
      folderId,
      written.itemId,
      item.kind === "file",
    );
  }
  return {
    ok: true,
    itemId: written.itemId,
    name,
    position,
    folderId,
    folderVersion,
    itemsWritten,
  };
}

/**
 * The change step: adds one item to a folder as one transaction. Answers a
 * refusal for the caller to turn into its own answer; throws FolderBusyError
 * when the folder could not be had in time, and StoreRefusedError when the
 * database refuses for a reason other than a duplicate name. In every such
 * case nothing was changed.
 */
export async function addItem(
  transactions: Transactions,
  item: NewItem,
): Promise<AddItemResult> {
  try {
    return await transactions.transaction((connection) =>
      addItemWithin(connection, item),
    );
  } catch (error) {
    if (error instanceof RefusedAfterWriting) {
      // Rolled back: nothing was changed.
      return { ok: false, refusal: error.refusal };
    }
    throw error;
  }
}
