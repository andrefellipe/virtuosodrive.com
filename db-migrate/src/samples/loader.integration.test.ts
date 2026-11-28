import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getVisibleFile } from "../../../server/src/drive/file-reading.ts";
import { getFolderView } from "../../../server/src/drive/folder-reading.ts";
import { startPostgres } from "../testing/postgres.ts";
import type { TestDatabase } from "../testing/postgres.ts";
import { loadSamples, SampleLoadError } from "./loader.ts";
import type { SampleSummary } from "./loader.ts";
import { allNodes, expandSampleSet, SAMPLE_SET } from "./sample-set.ts";
import type { SampleNode } from "./sample-set.ts";

/** Everything about the items that loading decides; not identifiers or times. */
const SNAPSHOT = `
  SELECT item.source_key, item.kind, item.name, item.position, item.version,
         item.size, item.content_type, item.content_id,
         item.deleted_at IS NOT NULL AS deleted, item.deleted_reason,
         item.brought_over, parent.source_key AS parent_key,
         parent.parent_id IS NULL AS in_top_folder
  FROM items AS item
  LEFT JOIN items AS parent ON parent.id = item.parent_id
  ORDER BY item.source_key NULLS FIRST`;

/** A small set with every kind of entry, whose fifth entry can be made to fail. */
function smallSet(fifthName: string): SampleNode[] {
  const file = (key: string, name: string, more: object = {}) => ({
    key,
    kind: "file",
    name,
    size: 10,
    contentType: "text/plain",
    ...more,
  });
  return expandSampleSet({
    entries: [
      {
        key: "one",
        kind: "folder",
        name: "One",
        children: [
          file("two", "two.txt"),
          file("three", "three.txt", { deleted: true }),
          file("four", "four.txt"),
          file("five", fifthName),
          file("six", "six.txt"),
        ],
      },
      {
        key: "seven",
        kind: "folder",
        name: "Seven, deleted with what it holds",
        deleted: true,
        children: [
          file("eight", "eight.txt"),
          { key: "nine", kind: "folder", name: "Nine", children: [] },
        ],
      },
      file("ten", "ten.txt"),
    ],
  });
}

/**
 * The sample loader against a real PostgreSQL, on the change runner's own
 * kind of connection: the user "migrator", through the change step.
 */
describe("loading sample content", () => {
  const databases: TestDatabase[] = [];

  async function freshDatabase(): Promise<TestDatabase> {
    const database = await startPostgres();
    databases.push(database);
    return database;
  }

  function load(
    database: TestDatabase,
    samples?: readonly SampleNode[],
  ): Promise<SampleSummary> {
    return loadSamples({
      environment: "test",
      connect: () => database.connect("migrator"),
      ...(samples === undefined ? {} : { samples }),
      log: () => undefined,
    });
  }

  async function snapshot(database: TestDatabase): Promise<unknown[]> {
    const client = await database.connect("migrator");
    try {
      return (await client.query(SNAPSHOT)).rows;
    } finally {
      await client.end();
    }
  }

  afterAll(async () => {
    await Promise.all(databases.map((database) => database.stop()));
  });

  describe("the repository's sample set", () => {
    let database: TestDatabase;
    let first: SampleSummary;
    let afterFirst: unknown[];
    const total = allNodes(SAMPLE_SET).length;

    beforeAll(async () => {
      database = await freshDatabase();
      first = await load(database);
      afterFirst = await snapshot(database);
    });

    it("creates every entry, once, through the change step", () => {
      expect(first).toEqual({
        mode: "load-samples",
        environment: "test",
        created: total,
        found: 0,
        filled: 0,
      });
      // Every entry, and the top folder.
      expect(afterFirst).toHaveLength(total + 1);
    });

    it("gives the same table when loaded twice as when loaded once", async () => {
      const second = await load(database);

      expect(second).toEqual({
        mode: "load-samples",
        environment: "test",
        created: 0,
        found: total,
        filled: 0,
      });
      expect(await snapshot(database)).toEqual(afterFirst);
    });

    it("stores the name sent with an accent as two characters in its composed form, and no file has contents", () => {
      const rows = afterFirst as {
        source_key: string | null;
        name: string;
        content_id: string | null;
        brought_over: boolean;
      }[];
      const accented = rows.find(
        (row) => row.source_key === "sample:names/accent-as-two-characters",
      );

      expect(accented?.name).toBe(`Resum${String.fromCodePoint(0xe9)}.txt`);
      expect(rows.every((row) => row.content_id === null)).toBe(true);
      expect(rows.every((row) => !row.brought_over)).toBe(true);
    });

    it("hides the deleted sample file and folder, and the unmarked file inside the deleted folder", async () => {
      const app = await database.connect("app");
      try {
        const idOf = async (key: string): Promise<string> => {
          const row = await app.query<{ id: string }>(
            "SELECT id FROM items WHERE source_key = $1",
            [`sample:${key}`],
          );
          return (row.rows[0] as { id: string }).id;
        };

        const listed = await getFolderView(app, await idOf("deleted-things"));
        expect(listed).toMatchObject({
          kind: "folder",
          view: { items: [{ name: "Still here.txt" }] },
        });
        expect(
          await getFolderView(app, await idOf("deleted-things/deleted-folder")),
        ).toEqual({ kind: "notFound" });
        expect(
          await getFolderView(
            app,
            await idOf("deleted-things/deleted-folder/unmarked-folder"),
          ),
        ).toEqual({ kind: "notFound" });

        const unmarked = await idOf(
          "deleted-things/deleted-folder/unmarked-file",
        );
        const marks = await app.query<{ deleted_at: Date | null }>(
          "SELECT deleted_at FROM items WHERE id = $1",
          [unmarked],
        );
        expect(marks.rows[0]?.deleted_at).toBeNull();
        expect(await getVisibleFile(app, unmarked)).toBeUndefined();
        expect(
          await getVisibleFile(app, await idOf("deleted-things/deleted-file")),
        ).toBeUndefined();
        expect(
          await getVisibleFile(app, await idOf("deleted-things/still-here")),
        ).toMatchObject({ name: "Still here.txt", contentId: null });
      } finally {
        await app.end();
      }
    });

    it("lists the 500-item folder in the order of the sample set, and a path twelve folders deep", async () => {
      const app = await database.connect("app");
      try {
        const top = await getFolderView(app, "root");
        if (top.kind !== "folder") {
          throw new Error("The top folder was not answered");
        }
        expect(top.view.items.map((item) => item.name)).toEqual(
          SAMPLE_SET.map((node) => node.name),
        );
        const fiveHundred = top.view.items.find(
          (item) => item.name === "Five hundred items",
        );
        const large = await getFolderView(app, fiveHundred?.itemId ?? "");
        expect(large).toMatchObject({ kind: "folder", version: 501 });
        if (large.kind === "folder") {
          expect(large.view.items).toHaveLength(500);
          expect(large.view.items[0]?.name).toBe("Lecture notes 001.pdf");
          expect(large.view.items.at(-1)?.name).toBe("Lecture notes 500.pdf");
        }

        const bottom = await app.query<{ id: string }>(
          "SELECT parent_id AS id FROM items WHERE source_key LIKE $1",
          ["sample:level-01/%/bottom"],
        );
        const deepest = await getFolderView(app, bottom.rows[0]?.id ?? "");
        expect(deepest).toMatchObject({ kind: "folder" });
        if (deepest.kind === "folder") {
          expect(deepest.view.path).toHaveLength(13);
          expect(deepest.view.path[0]?.name).toBe("All");
        }
      } finally {
        await app.end();
      }
    });
  });

  describe("a run that fails half-way", () => {
    it("stops at the failing entry with a summary that names its key and kind, leaves what came before complete, and after repair gives the same table as a clean load", async () => {
      const interrupted = await freshDatabase();
      const clean = await freshDatabase();
      const written: SampleSummary[] = [];

      const failure = await loadSamples({
        environment: "test",
        connect: () => interrupted.connect("migrator"),
        samples: smallSet("not/valid.txt"),
        log: (summary) => written.push(summary),
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(SampleLoadError);
      expect(written).toEqual([
        {
          mode: "load-samples",
          environment: "test",
          created: 4,
          found: 0,
          filled: 0,
          failed: { key: "sample:one/five", kind: "nameHasForbiddenCharacter" },
        },
      ]);
      expect(JSON.stringify(written)).not.toContain("not/valid");
      const partial = (await snapshot(interrupted)) as {
        source_key: string | null;
      }[];
      expect(partial.map((row) => row.source_key)).toEqual([
        null,
        "sample:one",
        "sample:one/four",
        "sample:one/three",
        "sample:one/two",
      ]);

      // Repaired, and loaded again: it finds the four and carries on.
      const repaired = smallSet("five.txt");
      expect(await load(interrupted, repaired)).toEqual({
        mode: "load-samples",
        environment: "test",
        created: 6,
        found: 4,
        filled: 0,
      });
      expect(await load(clean, repaired)).toMatchObject({
        created: 10,
        found: 0,
      });

      const expected = await snapshot(clean);
      expect(await snapshot(interrupted)).toEqual(expected);
      // The deleted folder was made in one piece with what it holds; its
      // parent's version went up twice for it, and once for each other entry.
      expect(expected).toContainEqual(
        expect.objectContaining({
          source_key: "sample:seven",
          deleted: true,
          version: 3,
          in_top_folder: true,
        }),
      );
      expect(expected).toContainEqual(
        expect.objectContaining({
          source_key: "sample:seven/nine",
          deleted: false,
          parent_key: "sample:seven",
        }),
      );
      expect(expected).toContainEqual(
        expect.objectContaining({ source_key: null, name: "All", version: 5 }),
      );
    });

    it("fails at an entry whose name is the same as another's in its folder, creating nothing of it", async () => {
      const database = await freshDatabase();
      const samples = expandSampleSet({
        entries: [
          { key: "a", kind: "file", name: "Exam.pdf", size: 1 },
          {
            key: "b",
            kind: "folder",
            name: "Deleted, holding a name twice",
            deleted: true,
            children: [
              { key: "c", kind: "file", name: "same.txt", size: 1 },
              { key: "d", kind: "file", name: "SAME.txt", size: 1 },
            ],
          },
        ],
      });

      await expect(load(database, samples)).rejects.toThrow(
        'failed at entry "sample:b": nameAlreadyUsed',
      );

      // The folder and its first file were written and then rolled back.
      const rows = (await snapshot(database)) as {
        source_key: string | null;
      }[];
      expect(rows.map((row) => row.source_key)).toEqual([null, "sample:a"]);
    });
  });
});
