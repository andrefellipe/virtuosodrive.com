import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TransactionAbandonedError } from "../../server/src/db/database.ts";
import { clientTransactions } from "./client-transactions.ts";
import { insertFolder, topFolderId } from "./testing/items.ts";
import { startPostgres } from "./testing/postgres.ts";
import type { TestDatabase } from "./testing/postgres.ts";

const RAISE = "UPDATE items SET version = version + 1 WHERE id = $1";
const ADD_FILE =
  "INSERT INTO items (kind, parent_id, name, position, version, size) VALUES ('file', $1, $2, $3, NULL, 0)";

/**
 * Transactions on the change runner's own connection, against a real
 * PostgreSQL: all of the work is kept, or none of it, and nothing the work
 * sends after its transaction has ended is kept on its own.
 */
describe("transactions on the change runner's connection", () => {
  let database: TestDatabase;
  let migrator: Client;
  let folder: string;
  let made = 0;

  async function newFolder(): Promise<void> {
    made += 1;
    folder = await insertFolder(
      migrator,
      await topFolderId(migrator),
      `runner transaction test ${made}`,
    );
  }

  async function state() {
    const names = await migrator.query<{ name: string }>(
      "SELECT name FROM items WHERE parent_id = $1 ORDER BY position",
      [folder],
    );
    const version = await migrator.query<{ version: number }>(
      "SELECT version FROM items WHERE id = $1",
      [folder],
    );
    return {
      names: names.rows.map((row) => row.name),
      version: version.rows[0]?.version,
    };
  }

  /** A write the work does not wait for, sent a moment after the work has ended. */
  function writtenLate(send: () => Promise<unknown>): Promise<unknown> {
    return new Promise((resolve) => setTimeout(resolve, 100)).then(() =>
      send().catch((error: unknown) => error),
    );
  }

  beforeAll(async () => {
    database = await startPostgres();
    migrator = await database.connect("migrator");
  });

  afterAll(async () => {
    await migrator?.end();
    await database?.stop();
  });

  it("keeps everything the work did, and hands back what the work answered", async () => {
    await newFolder();

    const answered = await clientTransactions(migrator).transaction(
      async (connection) => {
        await connection.query(ADD_FILE, [folder, "kept.txt", 1]);
        await connection.query(RAISE, [folder]);
        expect(connection.remainingMs()).toBeUndefined();
        return "done";
      },
    );

    expect(answered).toBe("done");
    expect(await state()).toEqual({ names: ["kept.txt"], version: 2 });
  });

  it("keeps nothing when the work fails, and passes the failure on", async () => {
    await newFolder();

    await expect(
      clientTransactions(migrator).transaction(async (connection) => {
        await connection.query(ADD_FILE, [folder, "never kept.txt", 1]);
        await connection.query(RAISE, [folder]);
        throw new Error("the work failed, on purpose");
      }),
    ).rejects.toThrow("the work failed, on purpose");

    expect(await state()).toEqual({ names: [], version: 1 });
    // The connection is in no transaction and can be used again.
    await migrator.query(RAISE, [folder]);
    expect((await state()).version).toBe(2);
  });

  it("refuses a statement the work sends after it has failed, so that the statement is not kept on its own", async () => {
    await newFolder();
    let late: Promise<unknown> = Promise.resolve();

    await expect(
      clientTransactions(migrator).transaction(async (connection) => {
        late = writtenLate(() =>
          connection.query(ADD_FILE, [folder, "written late.txt", 2]),
        );
        await connection.query(ADD_FILE, [folder, "written first.txt", 1]);
        throw new Error("the work failed, on purpose");
      }),
    ).rejects.toThrow("the work failed, on purpose");

    expect(await late).toBeInstanceOf(TransactionAbandonedError);
    expect(await state()).toEqual({ names: [], version: 1 });
  });

  it("refuses a statement the work sends after its transaction was committed", async () => {
    await newFolder();
    let late: Promise<unknown> = Promise.resolve();

    await clientTransactions(migrator).transaction(async (connection) => {
      late = writtenLate(() =>
        connection.query(ADD_FILE, [folder, "written late.txt", 2]),
      );
      await connection.query(ADD_FILE, [folder, "written first.txt", 1]);
    });

    expect(await late).toBeInstanceOf(TransactionAbandonedError);
    expect(await state()).toEqual({ names: ["written first.txt"], version: 1 });
  });
});
