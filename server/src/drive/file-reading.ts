import type { Queryable } from "../db/database.ts";
import { isItemIdentifier } from "./identifiers.ts";
import { walkToTop } from "./walk.ts";

/** A visible file, as another Unit that asks for it is told (contract C9). */
export interface VisibleFile {
  fileId: string;
  name: string;
  /** Whole bytes. */
  size: number;
  /** The type the file was stored with, when one was recorded. */
  contentType: string | null;
  /**
   * Where its contents are kept. Null until U4 fills it (rules BR2.8): the
   * caller must then treat the file as having nothing to download.
   */
  contentId: string | null;
}

/**
 * Looks a file up for another Unit (rules BR1.11). A file is visible only
 * when neither it nor any folder above it is deleted. Answers undefined,
 * which every caller reports as "not found", in each of these cases alike:
 * the file never existed, was deleted, sits inside a deleted folder, the
 * identifier is a folder's, or the identifier is not of the generated form
 * (then without asking the database).
 */
export async function getVisibleFile(
  connection: Queryable,
  fileId: string,
): Promise<VisibleFile | undefined> {
  if (!isItemIdentifier(fileId)) {
    return undefined;
  }
  const walk = await walkToTop(connection, fileId);
  if (!walk.visible || walk.item.kind !== "file") {
    return undefined;
  }
  return {
    fileId: walk.item.id,
    name: walk.item.name,
    size: walk.item.size ?? 0,
    contentType: walk.item.contentType,
    contentId: walk.item.contentId,
  };
}
