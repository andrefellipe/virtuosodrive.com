import type { Fault } from "../log/fault.ts";

/**
 * What may be said about a failure of the database (observability design
 * O22, O23). The database's own message can quote the value that broke a
 * rule, which here is a file's or folder's name. So nothing in this module,
 * and nothing that logs through it, reads or keeps that message: only the
 * error's code and the name of the rule it reports.
 */

/** PostgreSQL's code for "the lock could not be obtained in the time allowed". */
export const LOCK_NOT_AVAILABLE = "55P03";

/** The index that holds "no two names the same in one folder". */
export const NAME_UNIQUE_RULE = "items_name_unique_in_folder";

/** PostgreSQL's class of codes for a rule of the structure refusing a write. */
const INTEGRITY_CLASS = "23";

export interface DescribedDatabaseError {
  /** The database's five-character code, when the error carries one. */
  code?: string;
  /** The name of the rule the database reports, when it reports one. */
  rule?: string;
}

function textField(error: object, field: string): string | undefined {
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Turns a database error into what may be logged: its code and the name of
 * the rule, nothing else. A "must not be empty" refusal names no rule, so
 * the column stands in for one; neither is a value a person typed.
 */
export function describeDatabaseError(error: unknown): DescribedDatabaseError {
  if (typeof error !== "object" || error === null) {
    return {};
  }
  const code = textField(error, "code");
  const constraint = textField(error, "constraint");
  const column = textField(error, "column");
  const rule =
    constraint ?? (column === undefined ? undefined : `not null: ${column}`);
  return {
    ...(code !== undefined && /^[0-9A-Z]{5}$/.test(code) ? { code } : {}),
    ...(rule === undefined ? {} : { rule }),
  };
}

/** Whether the database refused a write because a rule of its structure forbids it. */
export function isStoreRefusal(error: unknown): boolean {
  return (
    describeDatabaseError(error).code?.startsWith(INTEGRITY_CLASS) === true
  );
}

/** Whether the refusal is the one for a name already used in the folder. */
export function isDuplicateName(error: unknown): boolean {
  return (
    isStoreRefusal(error) &&
    describeDatabaseError(error).rule === NAME_UNIQUE_RULE
  );
}

/** Whether a wait for a folder ended because the time allowed ran out. */
export function isLockTimeout(error: unknown): boolean {
  return describeDatabaseError(error).code === LOCK_NOT_AVAILABLE;
}

/**
 * The walk towards the top reached its limit without reaching the top
 * (security design S26). Damaged data, or a tree deeper than the site allows.
 */
export class PathTooDeepError extends Error {
  readonly fault: Fault = "pathTooDeep";
  readonly folderId: string;

  constructor(folderId: string, limit: number) {
    super(
      `The walk from item ${folderId} did not reach the top folder within ${limit} levels`,
    );
    this.name = "PathTooDeepError";
    this.folderId = folderId;
  }
}

/**
 * A change could not get its folder within the wait allowed (reliability
 * design R21). Nothing was changed, so the change is safe to try again.
 */
export class FolderBusyError extends Error {
  readonly fault: Fault = "folderBusy";
  readonly folderId: string;

  constructor(folderId: string) {
    super(`Folder ${folderId} was held by another change for too long`);
    this.name = "FolderBusyError";
    this.folderId = folderId;
  }
}

/**
 * The database refused a write for a reason other than a duplicate name.
 * Carries the code and the rule's name; deliberately not the database's
 * error or its message.
 */
export class StoreRefusedError extends Error {
  readonly fault: Fault = "storeRefused";
  readonly code: string | undefined;
  readonly rule: string | undefined;
  readonly folderId: string;

  constructor(folderId: string, refusal: unknown) {
    const described = describeDatabaseError(refusal);
    super(
      `The database refused a write in folder ${folderId}: code ${described.code ?? "unknown"}, rule ${described.rule ?? "unknown"}`,
    );
    this.name = "StoreRefusedError";
    this.code = described.code;
    this.rule = described.rule;
    this.folderId = folderId;
  }
}
