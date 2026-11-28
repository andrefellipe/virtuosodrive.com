import { runner } from "node-pg-migrate";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CONTROL_CHARACTERS,
  codePointName,
  FORMATTING_CHARACTERS,
  WHITE_SPACE_CHARACTERS,
} from "../../server/src/drive/testing/listed-characters.ts";
import {
  directWriteAccepted,
  SAMENESS_CASES,
  VALIDITY_CASES,
} from "../../server/src/drive/testing/name-cases.ts";
import { applyMigrations, MIGRATIONS_TABLE } from "./apply-migrations.ts";
import { MIGRATIONS_DIR } from "./paths.ts";
import {
  insertFolder,
  insertItemDirectly,
  markDeleted,
  topFolderId,
} from "./testing/items.ts";
import { startPostgres } from "./testing/postgres.ts";
import type { TestDatabase } from "./testing/postgres.ts";

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const INSUFFICIENT_PRIVILEGE = "42501";
const GENERATED_ALWAYS = "428C9";
const ITEMS_CHANGE = "0002_items";

/**
 * The rules the `items` table holds by its own structure (reliability design
 * R22). Each test tries to break one rule with a direct write and expects a
 * refusal that names that rule. Every test works in a folder of its own.
 */
describe("the items table", () => {
  let database: TestDatabase;
  let migrator: Client;
  let top: string;
  let folders = 0;

  /** A new folder directly inside "All", for one test. */
  function workFolder(): Promise<string> {
    folders += 1;
    return insertFolder(migrator, top, `work folder ${folders}`);
  }

  beforeAll(async () => {
    database = await startPostgres();
    migrator = await database.connect("migrator");
    top = await topFolderId(migrator);
  });

  afterAll(async () => {
    await migrator?.end();
    await database?.stop();
  });

  describe("the top folder", () => {
    it('exists from the start: one folder named "All", with no parent, no position and version 1', async () => {
      const rows = await migrator.query(
        "SELECT kind, name, parent_id, position, version, deleted_at, brought_over, source_key FROM items WHERE parent_id IS NULL",
      );

      expect(rows.rows).toEqual([
        {
          kind: "folder",
          name: "All",
          parent_id: null,
          position: null,
          version: 1,
          deleted_at: null,
          brought_over: false,
          source_key: null,
        },
      ]);
    });

    it("refuses a second item with no parent", async () => {
      await expect(
        insertItemDirectly(migrator, {
          kind: "folder",
          parentId: null,
          name: "All",
          position: null,
        }),
      ).rejects.toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint: "items_one_top_folder",
      });
    });

    it("refuses an item with no parent that is a file, or is not named All", async () => {
      for (const item of [
        { kind: "file", name: "All" },
        { kind: "folder", name: "Another top" },
      ] as const) {
        await expect(
          insertItemDirectly(migrator, {
            ...item,
            parentId: null,
            position: null,
          }),
        ).rejects.toMatchObject({
          code: CHECK_VIOLATION,
          constraint: "items_top_folder_stays",
        });
      }
    });

    it("cannot be renamed or marked deleted", async () => {
      await expect(
        migrator.query("UPDATE items SET name = $1 WHERE id = $2", [
          "Everything",
          top,
        ]),
      ).rejects.toMatchObject({ constraint: "items_top_folder_stays" });
      await expect(
        migrator.query("UPDATE items SET deleted_at = now() WHERE id = $1", [
          top,
        ]),
      ).rejects.toMatchObject({ constraint: "items_top_folder_stays" });
    });
  });

  describe("the parent", () => {
    it("refuses a parent that does not exist", async () => {
      await expect(
        insertItemDirectly(migrator, {
          kind: "folder",
          parentId: "00000000-0000-4000-8000-000000000000",
          name: "orphan",
          position: 1,
        }),
      ).rejects.toMatchObject({
        code: FOREIGN_KEY_VIOLATION,
        constraint: "items_parent_is_a_folder",
      });
    });

    it("refuses a parent that is a file", async () => {
      const folder = await workFolder();
      const file = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: "notes.txt",
      });

      await expect(
        insertItemDirectly(migrator, {
          kind: "file",
          parentId: file,
          name: "inside a file.txt",
          position: 1,
        }),
      ).rejects.toMatchObject({
        code: FOREIGN_KEY_VIOLATION,
        constraint: "items_parent_is_a_folder",
      });
    });

    it("refuses an item that is its own parent", async () => {
      const own = "11111111-1111-4111-8111-111111111111";
      await expect(
        migrator.query(
          "INSERT INTO items (id, kind, parent_id, name, position) VALUES ($1, $2, $1, $3, $4)",
          [own, "folder", "loop", 1],
        ),
      ).rejects.toMatchObject({
        code: CHECK_VIOLATION,
        constraint: "items_not_its_own_parent",
      });
    });

    it("does not let the derived columns be written", async () => {
      const folder = await workFolder();
      await expect(
        migrator.query(
          "INSERT INTO items (kind, parent_id, parent_kind, name, position) VALUES ($1, $2, $3, $4, $5)",
          ["folder", folder, "file", "x", 1],
        ),
      ).rejects.toMatchObject({ code: GENERATED_ALWAYS });
      await expect(
        migrator.query(
          "INSERT INTO items (kind, parent_id, name, name_key, position) VALUES ($1, $2, $3, $4, $5)",
          ["folder", folder, "x", "another key", 1],
        ),
      ).rejects.toMatchObject({ code: GENERATED_ALWAYS });
    });
  });

  describe("positions", () => {
    it("refuses a repeated position in one folder, a deleted item's included", async () => {
      const folder = await workFolder();
      const first = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: "first.txt",
        position: 1,
      });
      const repeat = () =>
        insertItemDirectly(migrator, {
          kind: "file",
          parentId: folder,
          name: "second.txt",
          position: 1,
        });

      await expect(repeat()).rejects.toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint: "items_position_unique_in_folder",
      });
      await markDeleted(migrator, first);
      await expect(repeat()).rejects.toMatchObject({
        constraint: "items_position_unique_in_folder",
      });
    });

    it("accepts the same position in two different folders", async () => {
      const one = await workFolder();
      const other = await workFolder();
      for (const parentId of [one, other]) {
        await expect(
          insertItemDirectly(migrator, {
            kind: "file",
            parentId,
            name: "same place.txt",
            position: 7,
          }),
        ).resolves.toEqual(expect.any(String));
      }
    });

    it("refuses an item in a folder with no position, or with one below 1", async () => {
      const folder = await workFolder();
      for (const position of [null, 0]) {
        await expect(
          insertItemDirectly(migrator, {
            kind: "file",
            parentId: folder,
            name: `position ${String(position)}.txt`,
            position,
          }),
        ).rejects.toMatchObject({
          code: CHECK_VIOLATION,
          constraint: "items_position_present",
        });
      }
    });
  });

  describe("names", () => {
    it("refuses a repeated name key among items not deleted, and accepts the same name on a deleted item", async () => {
      const folder = await workFolder();
      const first = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: "Exam.pdf",
      });

      // A folder and a file share one set of names.
      await expect(
        insertItemDirectly(migrator, {
          kind: "folder",
          parentId: folder,
          name: "exam.PDF",
        }),
      ).rejects.toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint: "items_name_unique_in_folder",
      });
      await expect(
        insertItemDirectly(migrator, {
          kind: "file",
          parentId: folder,
          name: "EXAM.PDF",
          deleted: true,
        }),
      ).resolves.toEqual(expect.any(String));

      await markDeleted(migrator, first);
      await expect(
        insertItemDirectly(migrator, {
          kind: "file",
          parentId: folder,
          name: "exam.pdf",
        }),
      ).resolves.toEqual(expect.any(String));
    });

    it("derives the key by folding one character to one character", async () => {
      const folder = await workFolder();
      const sharpS = String.fromCodePoint(0xdf);
      const id = await insertItemDirectly(migrator, {
        kind: "file",
        parentId: folder,
        name: `STRA${sharpS}E Exam.PDF`,
      });

      const row = await migrator.query<{ name_key: string }>(
        "SELECT name_key FROM items WHERE id = $1",
        [id],
      );
      expect(row.rows[0]?.name_key).toBe(`stra${sharpS}e exam.pdf`);
    });

    it.each([
      ["items_name_composed", `e${String.fromCodePoint(0x301)}`],
      ["items_name_length", ""],
      ["items_name_length", "a".repeat(256)],
      ["items_name_not_dots", "."],
      ["items_name_not_dots", ".."],
      ["items_name_no_forbidden_character", "a/b"],
      ["items_name_no_forbidden_character", `a${String.fromCodePoint(0x9)}b`],
      [
        "items_name_no_forbidden_character",
        `a${String.fromCodePoint(0x200b)}b`,
      ],
      ["items_name_no_white_space_at_ends", " a"],
      ["items_name_no_white_space_at_ends", `a${String.fromCodePoint(0xa0)}`],
    ])("holds the check %s", async (constraint, name) => {
      const folder = await workFolder();
      await expect(
        insertItemDirectly(migrator, { kind: "file", parentId: folder, name }),
      ).rejects.toMatchObject({ code: CHECK_VIOLATION, constraint });
    });

    it.each(VALIDITY_CASES)(
      "name case $row as a direct write: $what",
      async (testCase) => {
        const folder = await workFolder();
        const write = insertItemDirectly(migrator, {
          kind: "file",
          parentId: folder,
          name: testCase.input,
        });

        if (directWriteAccepted(testCase)) {
          await expect(write).resolves.toEqual(expect.any(String));
        } else {
          await expect(write).rejects.toMatchObject({
            code: CHECK_VIOLATION,
            constraint: expect.stringMatching(/^items_name_/),
          });
        }
      },
    );

    it.each(SAMENESS_CASES)(
      "name case $row as two direct writes: $what",
      async (testCase) => {
        const folder = await workFolder();
        await insertItemDirectly(migrator, {
          kind: "file",
          parentId: folder,
          name: testCase.first,
        });
        const second = insertItemDirectly(migrator, {
          kind: "file",
          parentId: folder,
          name: testCase.secondStored,
        });

        if (testCase.same) {
          await expect(second).rejects.toMatchObject({
            code: UNIQUE_VIOLATION,
            constraint: "items_name_unique_in_folder",
          });
        } else {
          await expect(second).resolves.toEqual(expect.any(String));
        }
      },
    );

    it("refuses every listed white-space character at either end of a name", async () => {
      const folder = await workFolder();
      const accepted: string[] = [];
      for (const character of WHITE_SPACE_CHARACTERS) {
        for (const name of [`${character}a`, `a${character}`]) {
          await insertItemDirectly(migrator, {
            kind: "file",
            parentId: folder,
            name,
          }).then(
            () => accepted.push(codePointName(character)),
            // Some are refused by an earlier check: a tab is also a control
            // character, and U+2000 and U+2001 are not in the composed form.
            (error: { constraint?: string }) =>
              expect(error.constraint).toMatch(
                /^items_name_(no_white_space_at_ends|no_forbidden_character|composed)$/,
              ),
          );
        }
      }
      expect(WHITE_SPACE_CHARACTERS.length).toBeGreaterThan(20);
      expect(accepted).toEqual([]);
    });

    it("refuses every listed formatting character and every control character anywhere in a name", async () => {
      const folder = await workFolder();
      const accepted: string[] = [];
      const forbidden = [...FORMATTING_CHARACTERS, ...CONTROL_CHARACTERS];
      for (const character of forbidden) {
        await insertItemDirectly(migrator, {
          kind: "file",
          parentId: folder,
          name: `a${character}b`,
        }).then(
          () => accepted.push(codePointName(character)),
          (error: { constraint?: string }) =>
            expect(error.constraint).toBe("items_name_no_forbidden_character"),
        );
      }
      expect(FORMATTING_CHARACTERS.length).toBeGreaterThan(150);
      expect(CONTROL_CHARACTERS).toHaveLength(64);
      expect(accepted).toEqual([]);
    });
  });

  describe("what belongs to a folder and what to a file", () => {
    it("refuses a file without a size or with a negative one, and a folder with one", async () => {
      const folder = await workFolder();
      for (const item of [
        { kind: "file", name: "no size.txt", size: null },
        { kind: "file", name: "negative.txt", size: -1 },
        { kind: "folder", name: "sized folder", size: 10 },
      ] as const) {
        await expect(
          insertItemDirectly(migrator, { ...item, parentId: folder }),
        ).rejects.toMatchObject({
          code: CHECK_VIOLATION,
          constraint: "items_size_for_files_only",
        });
      }
    });

    it("refuses a folder without a version and a file with one", async () => {
      const folder = await workFolder();
      for (const item of [
        { kind: "folder", name: "no version", version: null },
        { kind: "folder", name: "version zero", version: 0 },
        { kind: "file", name: "versioned.txt", version: 1 },
      ] as const) {
        await expect(
          insertItemDirectly(migrator, { ...item, parentId: folder }),
        ).rejects.toMatchObject({
          code: CHECK_VIOLATION,
          constraint: "items_version_for_folders_only",
        });
      }
    });

    it("refuses a deletion reason without a deletion mark, and a deleted file without a reason", async () => {
      const folder = await workFolder();
      for (const item of [
        { name: "reason only.txt", deletedReason: "deleted" },
        { name: "mark only.txt", deleted: true, deletedReason: null },
      ]) {
        await expect(
          insertItemDirectly(migrator, {
            ...item,
            kind: "file",
            parentId: folder,
          }),
        ).rejects.toMatchObject({
          code: CHECK_VIOLATION,
          constraint: "items_deleted_reason_with_deletion",
        });
      }
    });

    it("refuses an unknown deletion reason, and a reason or a content type on a folder", async () => {
      const folder = await workFolder();
      await expect(
        insertItemDirectly(migrator, {
          kind: "file",
          parentId: folder,
          name: "lost.txt",
          deleted: true,
          deletedReason: "lost",
        }),
      ).rejects.toMatchObject({ constraint: "items_deleted_reason_known" });
      for (const item of [
        { name: "folder with reason", deleted: true, deletedReason: "deleted" },
        { name: "folder with type", contentType: "text/plain" },
      ]) {
        await expect(
          insertItemDirectly(migrator, {
            ...item,
            kind: "folder",
            parentId: folder,
          }),
        ).rejects.toMatchObject({
          constraint: "items_file_fields_for_files_only",
        });
      }
    });

    it("refuses a kind that is neither folder nor file", async () => {
      const folder = await workFolder();
      await expect(
        migrator.query(
          "INSERT INTO items (kind, parent_id, name, position, version) VALUES ($1, $2, $3, $4, $5)",
          ["link", folder, "shortcut", 1, null],
        ),
      ).rejects.toMatchObject({
        code: CHECK_VIOLATION,
        constraint: "items_kind_known",
      });
    });

    it("refuses a repeated source key, across folders and kinds", async () => {
      const one = await workFolder();
      const other = await workFolder();
      await insertItemDirectly(migrator, {
        kind: "folder",
        parentId: one,
        name: "loaded once",
        sourceKey: "sample:test/loaded-once",
      });

      await expect(
        insertItemDirectly(migrator, {
          kind: "file",
          parentId: other,
          name: "another name.txt",
          sourceKey: "sample:test/loaded-once",
        }),
      ).rejects.toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint: "items_source_key_unique",
      });
    });
  });

  describe("identifiers", () => {
    it("are generated at random: 1,000 made in a row are all different and all of the version-4 form", async () => {
      const folder = await workFolder();
      const made = await migrator.query<{ id: string }>(
        "INSERT INTO items (kind, parent_id, name, position, version, size) SELECT $1, $2, $3 || n, n, NULL, 0 FROM generate_series(1, 1000) AS n RETURNING id",
        ["file", folder, "file "],
      );

      const ids = made.rows.map((row) => row.id);
      expect(new Set(ids).size).toBe(1_000);
      for (const id of ids) {
        expect(id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      }
    });
  });

  describe("the server's database user", () => {
    it("can read items and cannot insert, update or delete", async () => {
      const app = await database.connect("app");
      try {
        const rows = await app.query<{ name: string }>(
          "SELECT name FROM items WHERE id = $1",
          [top],
        );
        expect(rows.rows).toEqual([{ name: "All" }]);

        await expect(
          app.query(
            "INSERT INTO items (kind, parent_id, name, position) VALUES ($1, $2, $3, $4)",
            ["folder", top, "made by app", 9_999],
          ),
        ).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
        await expect(
          app.query("UPDATE items SET version = version + 1 WHERE id = $1", [
            top,
          ]),
        ).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
        await expect(
          app.query("DELETE FROM items WHERE id = $1", [top]),
        ).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
        // Locking a row for a change is a right to write, which it has not.
        await expect(
          app.query("SELECT id FROM items WHERE id = $1 FOR UPDATE", [top]),
        ).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
      } finally {
        await app.end();
      }
    });
  });
});

describe("the change file that creates the items table", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await startPostgres({ migrate: false });
  });

  afterAll(async () => {
    await database?.stop();
  });

  it("applies to a database that has only the first change, and changes nothing when applied again", async () => {
    const migrator = await database.connect("migrator");
    try {
      // The database as the first Release left it: the first change only.
      const first = await runner({
        dbClient: migrator,
        dir: MIGRATIONS_DIR,
        direction: "up",
        migrationsTable: MIGRATIONS_TABLE,
        singleTransaction: false,
        count: 1,
        log: () => undefined,
      });
      expect(first.map((change) => change.name)).toEqual([
        "0001_site-information",
      ]);
      const installed = await migrator.query<{ installed_at: Date }>(
        "SELECT installed_at FROM site_information",
      );

      const applied = await applyMigrations(
        migrator,
        MIGRATIONS_DIR,
        () => undefined,
      );
      expect(applied[0]).toBe(ITEMS_CHANGE);

      const before = await migrator.query(
        "SELECT id, name, version, created_at FROM items",
      );
      const again = await applyMigrations(
        migrator,
        MIGRATIONS_DIR,
        () => undefined,
      );
      const after = await migrator.query(
        "SELECT id, name, version, created_at FROM items",
      );

      expect(again).toEqual([]);
      expect(before.rows).toHaveLength(1);
      expect(after.rows).toEqual(before.rows);
      // What the first Release reads is as it was.
      const stillInstalled = await migrator.query<{ installed_at: Date }>(
        "SELECT installed_at FROM site_information",
      );
      expect(stillInstalled.rows).toEqual(installed.rows);
    } finally {
      await migrator.end();
    }
  });
});
