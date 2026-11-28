import { describe, expect, it } from "vitest";
import {
  describeDatabaseError,
  FolderBusyError,
  isDuplicateName,
  isLockTimeout,
  isStoreRefusal,
  PathTooDeepError,
  StoreRefusedError,
} from "./store-errors.ts";

const FOLDER = "3f2b8c1e-9a4d-4e6f-8b7a-0c1d2e3f4a5b";
const A_NAME = "Prova final do Fulano.pdf";

/** An error as the database driver raises it: the message and detail quote the value. */
function databaseError(fields: Record<string, string>): Error {
  return Object.assign(
    new Error(
      `duplicate key value violates unique constraint (${A_NAME}) already exists`,
    ),
    {
      detail: `Key (parent_id, name_key)=(${FOLDER}, ${A_NAME}) already exists.`,
    },
    fields,
  );
}

describe("what may be said about a database failure", () => {
  it("keeps the code and the name of the rule, and nothing else", () => {
    const described = describeDatabaseError(
      databaseError({
        code: "23505",
        constraint: "items_name_unique_in_folder",
        table: "items",
      }),
    );

    expect(described).toEqual({
      code: "23505",
      rule: "items_name_unique_in_folder",
    });
    expect(JSON.stringify(described)).not.toContain("Fulano");
  });

  it("names the column for a refusal that reports no rule", () => {
    expect(
      describeDatabaseError(databaseError({ code: "23502", column: "name" })),
    ).toEqual({ code: "23502", rule: "not null: name" });
  });

  it("says nothing about something that is not a database error", () => {
    expect(describeDatabaseError(new Error(A_NAME))).toEqual({});
    expect(describeDatabaseError("plain text")).toEqual({});
    expect(describeDatabaseError(null)).toEqual({});
    // A code that is not of the database's five-character form is not kept.
    expect(describeDatabaseError({ code: `ECONNRESET ${A_NAME}` })).toEqual({});
  });

  it("tells the duplicate name, other refusals of the structure, and a lock that timed out apart", () => {
    const duplicate = databaseError({
      code: "23505",
      constraint: "items_name_unique_in_folder",
    });
    const position = databaseError({
      code: "23505",
      constraint: "items_position_unique_in_folder",
    });
    const busy = databaseError({ code: "55P03" });

    expect(isDuplicateName(duplicate)).toBe(true);
    expect(isDuplicateName(position)).toBe(false);
    expect(isStoreRefusal(position)).toBe(true);
    expect(isStoreRefusal(busy)).toBe(false);
    expect(isLockTimeout(busy)).toBe(true);
    expect(isLockTimeout(duplicate)).toBe(false);
    expect(isStoreRefusal(new Error("connection lost"))).toBe(false);
  });

  it("makes a storeRefused fault whose text holds the code and the rule but no name", () => {
    const refusal = new StoreRefusedError(
      FOLDER,
      databaseError({ code: "23514", constraint: "items_name_length" }),
    );

    expect(refusal).toMatchObject({
      name: "StoreRefusedError",
      fault: "storeRefused",
      code: "23514",
      rule: "items_name_length",
      folderId: FOLDER,
    });
    expect(refusal.message).toContain("items_name_length");
    expect(refusal.cause).toBeUndefined();
    expect(`${refusal.message}${refusal.stack ?? ""}`).not.toContain("Fulano");
  });

  it("names the other two faults of the store with the folder's identifier", () => {
    expect(new PathTooDeepError(FOLDER, 64)).toMatchObject({
      fault: "pathTooDeep",
      folderId: FOLDER,
      message: expect.stringContaining("64 levels"),
    });
    expect(new FolderBusyError(FOLDER)).toMatchObject({
      fault: "folderBusy",
      folderId: FOLDER,
    });
  });
});
