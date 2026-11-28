import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  insertFolder,
  topFolderId,
} from "../../../db-migrate/src/testing/items.ts";
import { startPostgres } from "../../../db-migrate/src/testing/postgres.ts";
import type { TestDatabase } from "../../../db-migrate/src/testing/postgres.ts";
import { Database, TransactionAbandonedError } from "./database.ts";
import type { DatabaseOptions } from "./database.ts";
import { DeadlineExceededError } from "./deadline.ts";

const RAISE = "UPDATE items SET version = version + 1 WHERE id = $1";
const ADD_FILE =
  "INSERT INTO items (kind, parent_id, name, position, version, size) VALUES ('file', $1, $2, $3, NULL, 0)";

/**
 * The method that runs a piece of work as one transaction (logical
 * components, change 6; reliability design R21), against a real PostgreSQL.
 */
describe("transactions on the server's database access", () => {
  let postgres: TestDatabase;
  let observer: Client;
  let folder: string;
  let made = 0;
  const opened: Database[] = [];

  function writer(options: DatabaseOptions = {}): Database {
    const database = new Database(
      {
        host: postgres.host,
        port: postgres.port,
        database: postgres.database,
        user: "migrator",
        caCertificate: postgres.caCertificate,
      },
      () => Promise.resolve(postgres.passwords.migrator),
      options,
    );
    opened.push(database);
    return database;
  }

  async function version(): Promise<number | undefined> {
    const row = await observer.query<{ version: number }>(
      "SELECT version FROM items WHERE id = $1",
      [folder],
    );
    return row.rows[0]?.version;
  }

  /** The states of the server's connections, as the database itself reports them. */
  async function connectionStates(): Promise<string[]> {
    const rows = await observer.query<{ state: string }>(
      "SELECT state FROM pg_stat_activity WHERE application_name = $1",
      ["virtuoso-drive-server"],
    );
    return rows.rows.map((row) => row.state);
  }

  beforeAll(async () => {
    postgres = await startPostgres();
    observer = await postgres.connect("master");
    await observer.query("GRANT pg_read_all_stats TO postgres");
  });

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((database) => database.close()));
  });

  afterAll(async () => {
    await observer?.end();
    await postgres?.stop();
  });

  async function newFolder(): Promise<void> {
    made += 1;
    folder = await insertFolder(
      observer,
      await topFolderId(observer),
      `transaction test ${made}`,
    );
  }

  it("commits everything the work did, and hands back what the work answered", async () => {
    await newFolder();
    const database = writer();

    const answered = await database.transaction(async (connection) => {
      await connection.query(RAISE, [folder]);
      await connection.query(RAISE, [folder]);
      expect(connection.remainingMs()).toBeGreaterThan(0);
      return "done";
    });

    expect(answered).toBe("done");
    expect(await version()).toBe(3);
  });

  it("leaves no transaction open on a connection that is used again", async () => {
    await newFolder();
    const database = writer();

    await database.transaction((connection) =>
      connection.query(RAISE, [folder]),
    );
    expect(await connectionStates()).toEqual(["idle"]);
    await database.transaction((connection) =>
      connection.query(RAISE, [folder]),
    );
    await database.run((connection) => connection.query(RAISE, [folder]));

    expect(await connectionStates()).toEqual(["idle"]);
    // One connection served all three, and each change is there exactly once.
    expect(database.connectionsOpened).toBe(1);
    expect(await version()).toBe(4);
  });

  it("changes nothing when the work fails, and discards the connection", async () => {
    await newFolder();
    const database = writer();
    await database.transaction((connection) =>
      connection.query(RAISE, [folder]),
    );

    await expect(
      database.transaction(async (connection) => {
        await connection.query(RAISE, [folder]);
        throw new Error("the work failed, on purpose");
      }),
    ).rejects.toThrow("the work failed, on purpose");

    expect(await version()).toBe(2);
    // The next piece of work opens a new connection; none is left in a transaction.
    await database.transaction((connection) =>
      connection.query(RAISE, [folder]),
    );
    expect(database.connectionsOpened).toBe(2);
    expect(await version()).toBe(3);
    expect(await connectionStates()).toEqual(["idle"]);
  });

  it("changes nothing when the database refuses a statement in the middle", async () => {
    await newFolder();
    const database = writer();

    await expect(
      database.transaction(async (connection) => {
        await connection.query(RAISE, [folder]);
        await connection.query("UPDATE items SET version = 0 WHERE id = $1", [
          folder,
        ]);
      }),
    ).rejects.toMatchObject({ constraint: "items_version_for_folders_only" });

    expect(await version()).toBe(1);
  });

  it("gives up when the deadline passes, changes nothing, and releases what the work held", async () => {
    await newFolder();
    const database = writer({ deadlineMs: 400 });
    const startedAt = Date.now();

    await expect(
      database.transaction(async (connection) => {
        await connection.query(RAISE, [folder]);
        await connection.query("SELECT pg_sleep($1)", [1.5]);
      }),
    ).rejects.toBeInstanceOf(DeadlineExceededError);

    // The rollback is not waited for longer than half a second.
    expect(Date.now() - startedAt).toBeLessThan(1_500);
    // The row the work had changed can be changed by another connection once
    // the abandoned statement ends, and the abandoned change is not there.
    await observer.query("SET lock_timeout = '5s'");
    await observer.query(RAISE, [folder]);
    expect(await version()).toBe(2);
  });

  it("refuses every statement the work still sends after the deadline has passed, so that neither its earlier write nor its later one is kept", async () => {
    await newFolder();
    // The deadline passes during the pause; the pause ends inside the half
    // second the rollback is waited for. Without the refusal, the rollback
    // would undo the first write, and the work, still running, would then
    // send its second write and its version rise after the rollback, where
    // each is kept on its own.
    const database = writer({ deadlineMs: 300 });
    let workEnded: Promise<unknown> = Promise.resolve();
    let sentAfterTheDeadline = 0;

    const outcome = database.transaction((connection) => {
      const work = async (): Promise<void> => {
        await connection.query(ADD_FILE, [folder, "written before.txt", 1]);
        await connection.query("SELECT pg_sleep($1)", [0.45]);
        sentAfterTheDeadline += 1;
        await connection.query(ADD_FILE, [folder, "written after.txt", 2]);
        sentAfterTheDeadline += 1;
        await connection.query(RAISE, [folder]);
      };
      const running = work();
      workEnded = running.catch((error: unknown) => error);
      return running;
    });

    await expect(outcome).rejects.toBeInstanceOf(DeadlineExceededError);
    // The work went on after it was given up, and was refused at its next statement.
    const refusal = await workEnded;
    expect(refusal).toBeInstanceOf(TransactionAbandonedError);
    expect(sentAfterTheDeadline).toBe(1);

    await observer.query("SET lock_timeout = '5s'");
    const kept = await observer.query(
      "SELECT name FROM items WHERE parent_id = $1",
      [folder],
    );
    expect(kept.rows).toEqual([]);
    expect(await version()).toBe(1);
    // The same access works again afterwards, on a new connection.
    await database.transaction((connection) =>
      connection.query(RAISE, [folder]),
    );
    expect(await version()).toBe(2);
  });

  it("refuses a statement sent on a transaction whose work has already failed", async () => {
    await newFolder();
    const database = writer();
    let late: Promise<unknown> = Promise.resolve();

    await expect(
      database.transaction(async (connection) => {
        // A branch the work does not wait for, which writes a moment later.
        late = new Promise((resolve) => setTimeout(resolve, 100)).then(() =>
          connection
            .query(ADD_FILE, [folder, "written late.txt", 1])
            .catch((error: unknown) => error),
        );
        await connection.query(RAISE, [folder]);
        throw new Error("the work failed, on purpose");
      }),
    ).rejects.toThrow("the work failed, on purpose");

    expect(await late).toBeInstanceOf(TransactionAbandonedError);
    const kept = await observer.query(
      "SELECT name FROM items WHERE parent_id = $1",
      [folder],
    );
    expect(kept.rows).toEqual([]);
    expect(await version()).toBe(1);
  });

  it("fails without running the work when no connection can be opened", async () => {
    let ran = false;
    const database = new Database(
      {
        host: postgres.host,
        port: postgres.port,
        database: postgres.database,
        user: "migrator",
        caCertificate: postgres.caCertificate,
      },
      () => Promise.resolve("not-the-token"),
    );
    opened.push(database);

    await expect(
      database.transaction(() => {
        ran = true;
        return Promise.resolve();
      }),
    ).rejects.toMatchObject({ code: "28P01" });
    expect(ran).toBe(false);
  });
});
