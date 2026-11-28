import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  insertFolder,
  insertItemDirectly,
  markDeleted,
  topFolderId,
} from "../../../db-migrate/src/testing/items.ts";
import { startPostgres } from "../../../db-migrate/src/testing/postgres.ts";
import type { TestDatabase } from "../../../db-migrate/src/testing/postgres.ts";
import { Database } from "../db/database.ts";
import type {
  DatabaseOptions,
  TransactionConnection,
  Transactions,
} from "../db/database.ts";
import {
  addItem,
  checkName,
  FOLDER_WAIT_LIMIT_MS,
  folderWaitMs,
  lowestFreeName,
} from "./change-step.ts";
import type { AddItemResult } from "./change-step.ts";
import { getFolderView } from "./folder-reading.ts";
import { NAME_LIMIT } from "./names.ts";
import { FolderBusyError, StoreRefusedError } from "./store-errors.ts";
import { SAMENESS_CASES, VALIDITY_CASES } from "./testing/name-cases.ts";

const UNKNOWN = "00000000-0000-4000-8000-000000000000";
const HOSTILE_NAME = `it's "x"; DROP TABLE items; -- $1.pdf`;

function added(result: AddItemResult) {
  if (!result.ok) {
    throw new Error(`Expected the item to be added, got "${result.refusal}"`);
  }
  return result;
}

/**
 * The change step and the name operations, against a real PostgreSQL. The
 * step runs as the user "migrator", the only user that may write in U3, on
 * the server's own database access so that its transactions are the ones
 * tested. Every test works in a folder of its own.
 */
describe("the change step", () => {
  let database: TestDatabase;
  let migrator: Client;
  let top: string;
  let made = 0;
  const opened: Database[] = [];

  function workFolder(): Promise<string> {
    made += 1;
    return insertFolder(migrator, top, `change test ${made}`);
  }

  /** Database access as the user that may write. Each has one connection of its own. */
  function writer(options: DatabaseOptions = {}): Database {
    const access = new Database(
      {
        host: database.host,
        port: database.port,
        database: database.database,
        user: "migrator",
        caCertificate: database.caCertificate,
      },
      () => Promise.resolve(database.passwords.migrator),
      options,
    );
    opened.push(access);
    return access;
  }

  /** The same transactions, with one kind of statement changed on its way. */
  function tamperedWith(
    access: Database,
    change: (
      text: string,
      connection: TransactionConnection,
    ) => Promise<{ rows: object[] } | undefined>,
  ): Transactions {
    return {
      transaction: (work) =>
        access.transaction((connection) =>
          work({
            remainingMs: () => connection.remainingMs(),
            async query<Row extends object>(
              text: string,
              values?: readonly unknown[],
            ) {
              const replaced = await change(text, connection);
              return replaced === undefined
                ? connection.query<Row>(text, values)
                : (replaced as { rows: Row[] });
            },
          }),
        ),
    };
  }

  async function state(folderId: string) {
    const folder = await migrator.query<{ version: number }>(
      "SELECT version FROM items WHERE id = $1",
      [folderId],
    );
    const items = await migrator.query<{
      name: string;
      position: number;
      deleted: boolean;
    }>(
      "SELECT name, position, deleted_at IS NOT NULL AS deleted FROM items WHERE parent_id = $1 ORDER BY position",
      [folderId],
    );
    return { version: folder.rows[0]?.version, items: items.rows };
  }

  beforeAll(async () => {
    database = await startPostgres();
    migrator = await database.connect("migrator");
    top = await topFolderId(migrator);
  });

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((access) => access.close()));
  });

  afterAll(async () => {
    await migrator?.end();
    await database?.stop();
  });

  describe("adding an item", () => {
    it("normalises the name, takes the next position, writes the item and raises the folder's version by one", async () => {
      const folder = await workFolder();
      const access = writer();

      const file = added(
        await addItem(access, {
          folderId: folder,
          kind: "file",
          name: "  notes.txt ",
          size: 42,
          contentType: "text/plain",
          sourceKey: "sample:test/notes",
        }),
      );
      const subfolder = added(
        await addItem(access, {
          folderId: folder,
          kind: "folder",
          name: "2019.1",
        }),
      );

      expect(file).toEqual({
        ok: true,
        itemId: expect.any(String),
        name: "notes.txt",
        position: 1,
        folderId: folder,
        folderVersion: 2,
        itemsWritten: 1,
      });
      expect(subfolder).toMatchObject({ position: 2, folderVersion: 3 });
      const rows = await migrator.query(
        "SELECT kind, name, position, version, size, content_type, content_id, source_key, brought_over, deleted_at FROM items WHERE parent_id = $1 ORDER BY position",
        [folder],
      );
      expect(rows.rows).toEqual([
        {
          kind: "file",
          name: "notes.txt",
          position: 1,
          version: null,
          size: "42",
          content_type: "text/plain",
          content_id: null,
          source_key: "sample:test/notes",
          brought_over: false,
          deleted_at: null,
        },
        {
          kind: "folder",
          name: "2019.1",
          position: 2,
          version: 1,
          size: null,
          content_type: null,
          content_id: null,
          source_key: null,
          brought_over: false,
          deleted_at: null,
        },
      ]);
    });

    it("gives the next position after the highest ever used, deleted items included", async () => {
      const folder = await workFolder();
      await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: "kept.txt",
        position: 3,
      });
      await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: "deleted.txt",
        position: 9,
        deleted: true,
      });

      const result = added(
        await addItem(writer(), {
          folderId: folder,
          kind: "file",
          name: "new.txt",
        }),
      );

      expect(result.position).toBe(10);
    });

    it("accepts root for the top folder and answers with its real identifier", async () => {
      made += 1;
      const result = added(
        await addItem(writer(), {
          folderId: "root",
          kind: "folder",
          name: `added to the top ${made}`,
        }),
      );

      expect(result.folderId).toBe(top);
    });

    it("creates an item already marked deleted in one step, raising the version twice", async () => {
      const folder = await workFolder();

      const file = added(
        await addItem(writer(), {
          folderId: folder,
          kind: "file",
          name: "deleted sample.txt",
          markDeleted: true,
        }),
      );
      const subfolder = added(
        await addItem(writer(), {
          folderId: folder,
          kind: "folder",
          name: "deleted folder",
          markDeleted: true,
        }),
      );

      expect(file.folderVersion).toBe(3);
      expect(subfolder.folderVersion).toBe(5);
      expect((await state(folder)).items).toEqual([
        { name: "deleted sample.txt", position: 1, deleted: true },
        { name: "deleted folder", position: 2, deleted: true },
      ]);
      const reasons = await migrator.query<{ deleted_reason: string | null }>(
        "SELECT deleted_reason FROM items WHERE parent_id = $1 ORDER BY position",
        [folder],
      );
      expect(reasons.rows.map((row) => row.deleted_reason)).toEqual([
        "deleted",
        null,
      ]);
    });

    it("creates a folder with what it holds, and marks it deleted, in one step", async () => {
      const folder = await workFolder();

      const result = added(
        await addItem(writer(), {
          folderId: folder,
          kind: "folder",
          name: "deleted with its contents",
          markDeleted: true,
          contents: [
            { kind: "file", name: "inside.txt", size: 5 },
            {
              kind: "folder",
              name: "inside too",
              contents: [{ kind: "file", name: "deeper.txt" }],
            },
          ],
        }),
      );

      expect(result).toMatchObject({ itemsWritten: 4, folderVersion: 3 });
      const inside = await state(result.itemId);
      // The new folder's own version went up once for each item put in it.
      expect(inside).toEqual({
        version: 3,
        items: [
          { name: "inside.txt", position: 1, deleted: false },
          { name: "inside too", position: 2, deleted: false },
        ],
      });
      expect(await state(folder)).toEqual({
        version: 3,
        items: [
          { name: "deleted with its contents", position: 1, deleted: true },
        ],
      });
    });

    it("refuses the whole step, changing nothing, when one of a new folder's contents is refused", async () => {
      const folder = await workFolder();

      for (const [bad, refusal] of [
        [{ kind: "file", name: "a/b" }, "nameHasForbiddenCharacter"],
        [{ kind: "file", name: "FIRST.txt" }, "nameAlreadyUsed"],
      ] as const) {
        expect(
          await addItem(writer(), {
            folderId: folder,
            kind: "folder",
            name: "never made",
            contents: [{ kind: "file", name: "first.txt" }, bad],
          }),
        ).toEqual({ ok: false, refusal });
      }
      expect(await state(folder)).toEqual({ version: 1, items: [] });
    });

    it("stores a name holding a quote and a fragment of a statement exactly as written", async () => {
      const folder = await workFolder();
      const access = writer();

      const first = added(
        await addItem(access, {
          folderId: folder,
          kind: "file",
          name: HOSTILE_NAME,
        }),
      );
      const second = added(
        await addItem(access, {
          folderId: folder,
          kind: "file",
          name: HOSTILE_NAME,
          whenNameIsTaken: "keepBoth",
        }),
      );

      expect(first.name).toBe(HOSTILE_NAME);
      expect(second.name).toBe(`it's "x"; DROP TABLE items; -- $1 (1).pdf`);
      expect((await state(folder)).items).toHaveLength(2);
    });
  });

  describe("refusals, each leaving the folder as it was", () => {
    it("answers not found for a folder that is unknown, deleted, inside a deleted folder, a file, or malformed", async () => {
      const parent = await workFolder();
      const deleted = await insertFolder(migrator, parent, "deleted");
      const inside = await insertFolder(migrator, deleted, "inside");
      const file = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: parent,
        name: "a file.txt",
      });
      await markDeleted(migrator, deleted);
      const access = writer();

      for (const folderId of [UNKNOWN, deleted, inside, file, "../", ""]) {
        expect(
          await addItem(access, { folderId, kind: "file", name: "x.txt" }),
        ).toEqual({ ok: false, refusal: "notFound" });
      }
      expect((await state(inside)).items).toEqual([]);
      expect((await state(inside)).version).toBe(1);
    });

    it.each(
      VALIDITY_CASES.filter((testCase) => "refused" in testCase.expected),
    )("refuses name case $row with its code: $what", async (testCase) => {
      const folder = await workFolder();

      expect(
        await addItem(writer(), {
          folderId: folder,
          kind: "file",
          name: testCase.input,
        }),
      ).toEqual({
        ok: false,
        refusal: (testCase.expected as { refused: string }).refused,
      });
      expect(await state(folder)).toEqual({ version: 1, items: [] });
    });

    it.each(SAMENESS_CASES)(
      "name case $row through the name check and the step: $what",
      async (testCase) => {
        const folder = await workFolder();
        const access = writer();
        added(
          await addItem(access, {
            folderId: folder,
            kind: "file",
            name: testCase.first,
          }),
        );

        const advice = await access.run((connection) =>
          checkName(connection, { folderId: folder, name: testCase.second }),
        );
        const second = await addItem(access, {
          folderId: folder,
          kind: "folder",
          name: testCase.second,
        });

        if (testCase.same) {
          expect(advice).toEqual({ ok: false, refusal: "nameAlreadyUsed" });
          expect(second).toEqual({ ok: false, refusal: "nameAlreadyUsed" });
          expect((await state(folder)).version).toBe(2);
        } else {
          expect(advice).toEqual({ ok: true, name: testCase.secondStored });
          expect(second).toMatchObject({
            ok: true,
            name: testCase.secondStored,
          });
        }
      },
    );

    it("leaves the folder and its version untouched when the step fails after its write", async () => {
      const folder = await workFolder();
      const access = writer();
      added(
        await addItem(access, {
          folderId: folder,
          kind: "file",
          name: "before.txt",
        }),
      );
      const before = await state(folder);
      let wrote = false;
      const failing = tamperedWith(access, (text) => {
        if (text.includes("INSERT INTO items")) {
          wrote = true;
        }
        if (text.includes("SET version = version + 1")) {
          return Promise.reject(
            new Error("failed after the write, on purpose"),
          );
        }
        return Promise.resolve(undefined);
      });

      await expect(
        addItem(failing, { folderId: folder, kind: "file", name: "never.txt" }),
      ).rejects.toThrow("failed after the write, on purpose");

      expect(wrote).toBe(true);
      expect(await state(folder)).toEqual(before);
      // And the same access works again afterwards, on a new connection.
      added(
        await addItem(access, {
          folderId: folder,
          kind: "file",
          name: "after.txt",
        }),
      );
      expect((await state(folder)).version).toBe(3);
    });

    it("reports the database's own refusal of a duplicate name as nameAlreadyUsed", async () => {
      const folder = await workFolder();
      const access = writer();
      added(
        await addItem(access, {
          folderId: folder,
          kind: "file",
          name: "Exam.pdf",
        }),
      );
      // A writer whose own check wrongly says the name is free: only the
      // database's unique index stands between it and a duplicate.
      const blind = tamperedWith(access, (text) =>
        Promise.resolve(
          text.includes("AS taken") ? { rows: [{ taken: false }] } : undefined,
        ),
      );

      expect(
        await addItem(blind, {
          folderId: folder,
          kind: "file",
          name: "exam.PDF",
        }),
      ).toEqual({ ok: false, refusal: "nameAlreadyUsed" });
      expect(await state(folder)).toEqual({
        version: 2,
        items: [{ name: "Exam.pdf", position: 1, deleted: false }],
      });
    });

    it("reports any other refusal by the database as storeRefused, with the rule's name and never the message", async () => {
      const folder = await workFolder();
      const other = await workFolder();
      const access = writer();
      added(
        await addItem(access, {
          folderId: folder,
          kind: "file",
          name: "Segredo do Fulano.pdf",
          sourceKey: "sample:test/repeated",
        }),
      );

      const failure = await addItem(access, {
        folderId: other,
        kind: "file",
        name: "Segredo do Fulano (copy).pdf",
        sourceKey: "sample:test/repeated",
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(StoreRefusedError);
      expect(failure).toMatchObject({
        fault: "storeRefused",
        code: "23505",
        rule: "items_source_key_unique",
        folderId: other,
      });
      const logged = JSON.stringify({
        message: (failure as Error).message,
        cause: (failure as Error).cause,
      });
      expect(logged).not.toContain("Segredo");
      expect(logged).not.toContain("sample:test");
      expect(await state(other)).toEqual({ version: 1, items: [] });
    });
  });

  describe("keeping both names", () => {
    it("gives the lowest free numbered name, before the extension, counting only items not deleted", async () => {
      const folder = await workFolder();
      const access = writer();
      const add = (name: string) =>
        addItem(access, {
          folderId: folder,
          kind: "file",
          name,
          whenNameIsTaken: "keepBoth",
        });

      expect(added(await add("exam.pdf")).name).toBe("exam.pdf");
      expect(added(await add("EXAM.pdf")).name).toBe("EXAM (1).pdf");
      const third = added(await add("exam.pdf"));
      expect(third.name).toBe("exam (2).pdf");
      await markDeleted(migrator, third.itemId);
      // The deleted item's name is free again; "(1)" is still taken.
      expect(added(await add("Exam.pdf")).name).toBe("Exam (2).pdf");
      expect(added(await add("2019.1")).name).toBe("2019.1");
      expect(added(await add("2019.1")).name).toBe("2019.1 (1)");
    });

    it("finds a free name beyond the first question's fifty", async () => {
      const folder = await workFolder();
      await migrator.query(
        "INSERT INTO items (kind, parent_id, name, position, version, size) SELECT $1, $2, CASE WHEN n = 0 THEN $3 ELSE $4 || n || $5 END, n + 1, NULL, 0 FROM generate_series(0, 60) AS n",
        ["file", folder, "report.pdf", "report (", ").pdf"],
      );
      const access = writer();

      const advice = await access.run((connection) =>
        lowestFreeName(connection, { folderId: folder, name: "REPORT.pdf" }),
      );

      expect(advice).toEqual({ ok: true, name: "REPORT (61).pdf" });
    });

    it("shortens the base at the 255-character limit and still finds a free name", async () => {
      const folder = await workFolder();
      const access = writer();
      const longest = `${"a".repeat(NAME_LIMIT - 4)}.pdf`;
      added(
        await addItem(access, {
          folderId: folder,
          kind: "file",
          name: longest,
        }),
      );

      const second = added(
        await addItem(access, {
          folderId: folder,
          kind: "file",
          name: longest,
          whenNameIsTaken: "keepBoth",
        }),
      );

      expect(second.name).toBe(`${"a".repeat(NAME_LIMIT - 8)} (1).pdf`);
      expect(Array.from(second.name)).toHaveLength(NAME_LIMIT);
    });
  });

  describe("the name operations on their own (design W5)", () => {
    it("answers not found for a hidden folder before the name is looked at", async () => {
      const parent = await workFolder();
      const deleted = await insertFolder(migrator, parent, "deleted");
      await markDeleted(migrator, deleted);
      const access = writer();

      for (const folderId of [deleted, UNKNOWN, "not an identifier"]) {
        expect(
          await access.run((connection) =>
            checkName(connection, { folderId, name: "a/b" }),
          ),
        ).toEqual({ ok: false, refusal: "notFound" });
        expect(
          await access.run((connection) =>
            lowestFreeName(connection, { folderId, name: "" }),
          ),
        ).toEqual({ ok: false, refusal: "notFound" });
      }
    });

    it("reports an invalid name with its code, and leaves out the item being renamed", async () => {
      const folder = await workFolder();
      const access = writer();
      const file = added(
        await addItem(access, {
          folderId: folder,
          kind: "file",
          name: HOSTILE_NAME,
        }),
      );
      const check = (name: string, ignoreItemId?: string) =>
        access.run((connection) =>
          checkName(connection, { folderId: folder, name, ignoreItemId }),
        );

      expect(await check("a/b")).toEqual({
        ok: false,
        refusal: "nameHasForbiddenCharacter",
      });
      expect(await check(HOSTILE_NAME.toUpperCase())).toEqual({
        ok: false,
        refusal: "nameAlreadyUsed",
      });
      expect(await check(HOSTILE_NAME.toUpperCase(), file.itemId)).toEqual({
        ok: true,
        name: HOSTILE_NAME.toUpperCase(),
      });
      expect(
        await access.run((connection) =>
          lowestFreeName(connection, { folderId: folder, name: "" }),
        ),
      ).toEqual({ ok: false, refusal: "nameEmpty" });
      expect(
        await access.run((connection) =>
          lowestFreeName(connection, {
            folderId: "root",
            name: "free in All.txt",
          }),
        ),
      ).toEqual({ ok: true, name: "free in All.txt" });
    });
  });

  describe("one change at a time per folder (rules BR2.11)", () => {
    it("gives twenty additions made at once twenty different positions and raises the version by twenty", async () => {
      const folder = await workFolder();
      const writers = Array.from({ length: 20 }, () => writer());

      const results = await Promise.all(
        writers.map((access, index) =>
          addItem(access, {
            folderId: folder,
            kind: "file",
            name: "upload.bin",
            whenNameIsTaken: "keepBoth",
            size: index,
          }),
        ),
      );

      const all = results.map(added);
      expect(new Set(all.map((result) => result.position))).toEqual(
        new Set(Array.from({ length: 20 }, (_unused, index) => index + 1)),
      );
      expect(new Set(all.map((result) => result.name)).size).toBe(20);
      expect((await state(folder)).version).toBe(21);
    });

    it("does not make changes to different folders wait for each other", async () => {
      const held = await workFolder();
      const free = await workFolder();
      const holder = await database.connect("migrator");
      try {
        await holder.query("BEGIN");
        await holder.query("SELECT id FROM items WHERE id = $1 FOR UPDATE", [
          held,
        ]);
        const startedAt = Date.now();

        added(
          await addItem(writer(), {
            folderId: free,
            kind: "file",
            name: "x.txt",
          }),
        );

        expect(Date.now() - startedAt).toBeLessThan(1_000);
      } finally {
        await holder.query("ROLLBACK");
        await holder.end();
      }
    });

    it("makes a second change to a held folder wait, and lets it through when the folder is released", async () => {
      const folder = await workFolder();
      const holder = await database.connect("migrator");
      try {
        await holder.query("BEGIN");
        await holder.query("SELECT id FROM items WHERE id = $1 FOR UPDATE", [
          folder,
        ]);
        let finished = false;
        const waiting = addItem(writer(), {
          folderId: folder,
          kind: "file",
          name: "waited.txt",
        }).finally(() => {
          finished = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(finished).toBe(false);

        await holder.query("COMMIT");

        expect(added(await waiting).position).toBe(1);
      } finally {
        await holder.end();
      }
    });

    it("reports folderBusy when the folder is held for longer than the wait allowed, changing nothing", async () => {
      const folder = await workFolder();
      const holder = await database.connect("migrator");
      try {
        await holder.query("BEGIN");
        await holder.query("SELECT id FROM items WHERE id = $1 FOR UPDATE", [
          folder,
        ]);
        // A deadline of 1.2 seconds leaves a wait of 0.7 for the folder.
        const startedAt = Date.now();
        const failure = await addItem(writer({ deadlineMs: 1_200 }), {
          folderId: folder,
          kind: "file",
          name: "too late.txt",
        }).catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(FolderBusyError);
        expect(failure).toMatchObject({
          fault: "folderBusy",
          folderId: folder,
        });
        expect(Date.now() - startedAt).toBeLessThan(1_200);
      } finally {
        await holder.query("ROLLBACK");
        await holder.end();
      }
      expect(await state(folder)).toEqual({ version: 1, items: [] });
    });

    it("allows a wait of 2 seconds, or what is left of the deadline less half a second", () => {
      expect(FOLDER_WAIT_LIMIT_MS).toBe(2_000);
      expect(folderWaitMs(undefined)).toBe(2_000);
      expect(folderWaitMs(3_000)).toBe(2_000);
      expect(folderWaitMs(1_200)).toBe(700);
      expect(folderWaitMs(400)).toBe(1);
    });
  });

  describe("readers never wait (scalability design C24)", () => {
    it("answers twenty readers of a folder held by a change with the earlier list", async () => {
      const folder = await workFolder();
      await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: "there before.txt",
      });
      const change = await database.connect("migrator");
      const readers = await Promise.all(
        Array.from({ length: 20 }, () => database.connect("app")),
      );
      try {
        // A change in progress: the folder is held, an item is written and
        // the version raised, and nothing is committed yet.
        await change.query("BEGIN");
        await change.query("SELECT id FROM items WHERE id = $1 FOR UPDATE", [
          folder,
        ]);
        await insertItemDirectly(change, {
          kind: "file",
          parentId: folder,
          name: "not committed yet.txt",
        });
        await change.query(
          "UPDATE items SET version = version + 1 WHERE id = $1",
          [folder],
        );
        const startedAt = Date.now();

        const answers = await Promise.all(
          readers.map((reader) => getFolderView(reader, folder)),
        );

        expect(Date.now() - startedAt).toBeLessThan(1_000);
        for (const answer of answers) {
          expect(answer).toMatchObject({
            kind: "folder",
            version: 1,
            view: { items: [{ name: "there before.txt" }] },
          });
        }
      } finally {
        await change.query("ROLLBACK");
        await Promise.all([
          change.end(),
          ...readers.map((reader) => reader.end()),
        ]);
      }
    });
  });
});
