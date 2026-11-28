import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  insertFolder,
  insertItemDirectly,
  markDeleted,
  topFolderId,
} from "../../../db-migrate/src/testing/items.ts";
import { startPostgres } from "../../../db-migrate/src/testing/postgres.ts";
import type { TestDatabase } from "../../../db-migrate/src/testing/postgres.ts";
import type { Queryable } from "../db/database.ts";
import { getVisibleFile } from "./file-reading.ts";
import { EVERYTHING, getFolderView } from "./folder-reading.ts";
import type { FolderAnswer } from "./folder-reading.ts";
import { PathTooDeepError } from "./store-errors.ts";
import { makeVersionTag } from "./version-tag.ts";
import { recursivePart, THE_WALK, WALK_LIMIT } from "./walk.ts";

const UNKNOWN = "00000000-0000-4000-8000-000000000000";
/** A name with a quote and a fragment of a statement in it (security design S30). */
const HOSTILE_NAME = `it's "x"; DROP TABLE items; -- $1`;

/** Counts the statements sent through it, and can act between two of them. */
function watched(
  connection: Queryable,
  afterStatement?: (text: string) => Promise<void>,
) {
  const statements: string[] = [];
  const queryable: Queryable = {
    async query<Row extends object>(text: string, values?: readonly unknown[]) {
      statements.push(text);
      const result = await connection.query<Row>(text, values);
      await afterStatement?.(text);
      return result;
    },
  };
  return { connection: queryable, statements };
}

function folderOf(answer: FolderAnswer) {
  if (answer.kind !== "folder") {
    throw new Error(`Expected a folder, got "${answer.kind}"`);
  }
  return answer;
}

/**
 * Reading folders and files, against a real PostgreSQL. Every test creates
 * its own content; none relies on sample content (NFR12.24). The reads are
 * made as the user "app", which is all the server has.
 */
describe("reading folders and files", () => {
  let database: TestDatabase;
  let migrator: Client;
  let app: Client;
  let top: string;
  let made = 0;

  /** A new folder directly inside "All", for one test. */
  function workFolder(): Promise<string> {
    made += 1;
    return insertFolder(migrator, top, `reading test ${made}`);
  }

  /** A chain of folders, each inside the one before; answers them top-down. */
  async function chain(parent: string, length: number): Promise<string[]> {
    const ids: string[] = [];
    let current = parent;
    for (let level = 0; level < length; level += 1) {
      current = await insertFolder(migrator, current, `level ${level + 1}`);
      ids.push(current);
    }
    return ids;
  }

  beforeAll(async () => {
    database = await startPostgres();
    migrator = await database.connect("migrator");
    app = await database.connect("app");
    top = await topFolderId(migrator);
  });

  afterAll(async () => {
    await app?.end();
    await migrator?.end();
    await database?.stop();
  });

  describe("a folder's answer", () => {
    it("carries the path from the top and the visible items in order of position, with exactly the named fields", async () => {
      const parent = await workFolder();
      const folder = await insertFolder(migrator, parent, "Circuits");
      const second = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: "second.pdf",
        position: 20,
        size: 2_048,
        contentType: "application/pdf",
      });
      await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: "deleted between.txt",
        position: 15,
        deleted: true,
      });
      const first = await insertItemDirectly(migrator, {
        kind: "folder",
        parentId: folder,
        name: "first",
        position: 10,
      });
      const third = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: "third with no type",
        position: 30,
        size: 0,
      });

      const answer = folderOf(await getFolderView(app, folder));

      expect(answer.version).toBe(1);
      expect(answer.view).toEqual({
        folderId: folder,
        name: "Circuits",
        path: [
          { folderId: top, name: "All" },
          { folderId: parent, name: expect.stringMatching(/^reading test/) },
          { folderId: folder, name: "Circuits" },
        ],
        items: [
          { itemId: first, kind: "folder", name: "first" },
          {
            itemId: second,
            kind: "file",
            name: "second.pdf",
            size: 2_048,
            contentType: "application/pdf",
          },
          { itemId: third, kind: "file", name: "third with no type", size: 0 },
        ],
      });
    });

    it("is the same for root and for the top folder's own identifier", async () => {
      const byRoot = folderOf(await getFolderView(app, "root"));
      const byIdentifier = folderOf(await getFolderView(app, top));

      expect(byRoot).toEqual(byIdentifier);
      expect(byRoot.view.folderId).toBe(top);
      expect(byRoot.view.name).toBe("All");
      expect(byRoot.view.path).toEqual([{ folderId: top, name: "All" }]);
    });

    it("has an empty list for a folder with no visible items", async () => {
      const folder = await workFolder();
      await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: "only a deleted file.txt",
        deleted: true,
      });

      expect(folderOf(await getFolderView(app, folder)).view.items).toEqual([]);
    });

    it("reads a name holding a quote and a fragment of a statement as plain text", async () => {
      const parent = await workFolder();
      const folder = await insertFolder(migrator, parent, HOSTILE_NAME);
      await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: HOSTILE_NAME,
      });

      const answer = folderOf(
        await getFolderView(app, folder, makeVersionTag(folder, 99)),
      );

      expect(answer.view.name).toBe(HOSTILE_NAME);
      expect(answer.view.path.at(-1)?.name).toBe(HOSTILE_NAME);
      expect(answer.view.items.map((item) => item.name)).toEqual([
        HOSTILE_NAME,
      ]);
      const stillThere = await migrator.query("SELECT count(*) FROM items");
      expect(Number(stillThere.rows[0]?.count)).toBeGreaterThan(1);
    });
  });

  describe("not found", () => {
    it("is the answer for a folder that is unknown, deleted, or inside a deleted folder, and for a file's identifier", async () => {
      const parent = await workFolder();
      const deleted = await insertFolder(migrator, parent, "deleted");
      const inside = await insertFolder(migrator, deleted, "inside");
      const deeper = await insertFolder(migrator, inside, "deeper");
      const file = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: parent,
        name: "a file.txt",
      });
      await markDeleted(migrator, deleted);

      for (const folderId of [UNKNOWN, deleted, inside, deeper, file]) {
        for (const held of [undefined, makeVersionTag(folderId, 1)]) {
          expect(await getFolderView(app, folderId, held)).toEqual({
            kind: "notFound",
          });
        }
      }
    });

    it("is answered without a statement when the identifier is not of the generated form", async () => {
      const { connection, statements } = watched(app);

      for (const malformed of ["", "../", top.toUpperCase(), "Root"]) {
        expect(await getFolderView(connection, malformed)).toEqual({
          kind: "notFound",
        });
        expect(await getVisibleFile(connection, malformed)).toBeUndefined();
      }
      expect(await getVisibleFile(connection, "root")).toBeUndefined();
      expect(statements).toEqual([]);
    });
  });

  describe("the number of statements (performance design P20)", () => {
    it("is one with no version, one for the current version, and two for a version out of date, whatever the size or depth", async () => {
      const small = await workFolder();
      await insertItemDirectly(migrator, {
        kind: "file",
        parentId: small,
        name: "one.txt",
      });
      const deep = (await chain(await workFolder(), 30)).at(-1) as string;
      await migrator.query(
        "INSERT INTO items (kind, parent_id, name, position, version, size) SELECT $1, $2, $3 || n, n, NULL, n FROM generate_series(1, 500) AS n",
        ["file", deep, "file "],
      );

      // One item at depth 1, and 500 items thirty folders further down.
      for (const [folder, items] of [
        [small, 1],
        [deep, 500],
      ] as const) {
        const none = watched(app);
        const full = folderOf(await getFolderView(none.connection, folder));
        expect(full.view.items).toHaveLength(items);
        expect(none.statements).toEqual([EVERYTHING]);

        const current = watched(app);
        expect(
          await getFolderView(
            current.connection,
            folder,
            makeVersionTag(folder, full.version),
          ),
        ).toEqual({ kind: "unchanged", folderId: folder, version: 1 });
        // "Unchanged" runs the walk only: no item is read.
        expect(current.statements).toEqual([THE_WALK]);

        const stale = watched(app);
        const again = folderOf(
          await getFolderView(
            stale.connection,
            folder,
            makeVersionTag(folder, full.version + 5),
          ),
        );
        expect(again).toEqual(full);
        expect(stale.statements).toEqual([THE_WALK, EVERYTHING]);
      }
    });

    it("opens both statements with the same walk, word for word", () => {
      expect(recursivePart(EVERYTHING)).toBe(recursivePart(THE_WALK));
      expect(recursivePart(THE_WALK)).toContain("WITH RECURSIVE walk");
    });
  });

  describe("one answer, one moment (reliability design R20)", () => {
    it("carries the version that matches its list when a change lands between the walk and the full statement", async () => {
      const folder = await workFolder();
      await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: "there from the start.txt",
      });
      // The caller holds an old version, so the walk runs first; when it has
      // finished, another connection adds an item and raises the version.
      const between = watched(app, async (text) => {
        if (text === THE_WALK) {
          await insertItemDirectly(migrator, {
            kind: "file",
            parentId: folder,
            name: "added meanwhile.txt",
          });
          await migrator.query(
            "UPDATE items SET version = version + 1 WHERE id = $1",
            [folder],
          );
        }
      });

      const answer = folderOf(
        await getFolderView(
          between.connection,
          folder,
          makeVersionTag(folder, 77),
        ),
      );

      expect(between.statements).toEqual([THE_WALK, EVERYTHING]);
      // The walk read version 1; the answer carries what the full statement read.
      expect(answer.version).toBe(2);
      expect(answer.view.items.map((item) => item.name)).toEqual([
        "there from the start.txt",
        "added meanwhile.txt",
      ]);
    });
  });

  describe('"unchanged" only for a folder that can still be seen (security design S27)', () => {
    it("answers not found to a caller holding the current version of a folder whose grandparent was deleted meanwhile", async () => {
      const [grandparent, , folder] = (await chain(await workFolder(), 3)) as [
        string,
        string,
        string,
      ];
      const held = makeVersionTag(
        folder,
        folderOf(await getFolderView(app, folder)).version,
      );
      expect((await getFolderView(app, folder, held)).kind).toBe("unchanged");

      // Deleting a folder marks only that folder; the version below is as it was.
      await markDeleted(migrator, grandparent);

      expect(await getFolderView(app, folder, held)).toEqual({
        kind: "notFound",
      });
      expect(await getFolderView(app, folder)).toEqual({ kind: "notFound" });
    });
  });

  describe("damaged data cannot hold a request (security design S26)", () => {
    it("reads a folder 64 levels down and treats one more level as the fault pathTooDeep", async () => {
      // "All" is the first level, so 63 more make 64.
      const levels = await chain(top, WALK_LIMIT);
      const deepest = levels[WALK_LIMIT - 2] as string;
      const tooDeep = levels[WALK_LIMIT - 1] as string;

      const answer = folderOf(await getFolderView(app, deepest));
      expect(answer.view.path).toHaveLength(WALK_LIMIT);
      expect(answer.view.path[0]).toEqual({ folderId: top, name: "All" });

      expect(WALK_LIMIT).toBe(64);
      for (const held of [undefined, makeVersionTag(tooDeep, 1)]) {
        const failure = await getFolderView(app, tooDeep, held).catch(
          (error: unknown) => error,
        );
        expect(failure).toBeInstanceOf(PathTooDeepError);
        expect(failure).toMatchObject({
          fault: "pathTooDeep",
          folderId: tooDeep,
        });
      }
      const file = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: deepest,
        name: "one level too deep.txt",
      });
      await expect(getVisibleFile(app, file)).rejects.toBeInstanceOf(
        PathTooDeepError,
      );
    });
  });

  describe("a file looked up for another Unit (rules BR1.11)", () => {
    it("is answered with its name, size, type and an empty contents reference", async () => {
      const folder = await workFolder();
      const file = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: HOSTILE_NAME,
        size: 12_345,
        contentType: "video/mp4",
      });

      expect(await getVisibleFile(app, file)).toEqual({
        fileId: file,
        name: HOSTILE_NAME,
        size: 12_345,
        contentType: "video/mp4",
        contentId: null,
      });
    });

    it("is not found when deleted, when unknown, when the identifier is a folder's, and when a folder above it is deleted though it carries no mark of its own", async () => {
      const parent = await workFolder();
      const deletedFolder = await insertFolder(migrator, parent, "deleted");
      const unmarked = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: deletedFolder,
        name: "no mark of its own.txt",
      });
      const deletedFile = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: parent,
        name: "deleted.txt",
        deleted: true,
      });
      expect(await getVisibleFile(app, unmarked)).toBeDefined();
      await markDeleted(migrator, deletedFolder);

      const marks = await migrator.query<{ deleted_at: Date | null }>(
        "SELECT deleted_at FROM items WHERE id = $1",
        [unmarked],
      );
      expect(marks.rows[0]?.deleted_at).toBeNull();
      for (const fileId of [unmarked, deletedFile, UNKNOWN, parent]) {
        expect(await getVisibleFile(app, fileId)).toBeUndefined();
      }
    });
  });
});
