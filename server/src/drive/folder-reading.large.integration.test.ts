import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  insertFolder,
  topFolderId,
} from "../../../db-migrate/src/testing/items.ts";
import { startPostgres } from "../../../db-migrate/src/testing/postgres.ts";
import type { TestDatabase } from "../../../db-migrate/src/testing/postgres.ts";
import { getFolderView } from "./folder-reading.ts";
import { NAME_LIMIT } from "./names.ts";
import { LARGE_FOLDER_ITEMS, fillLargeFolder } from "./testing/large-folder.ts";

/**
 * The guaranteed limit (scalability design C21): a folder of 4,000 items
 * whose names are 255 characters of four bytes each. Slow, so it is left out
 * of the quick local run and included in `npm run check`.
 */
describe("a folder of 4,000 items with the longest names", () => {
  let database: TestDatabase;
  let migrator: Client;
  let app: Client;
  let folder: string;

  beforeAll(async () => {
    database = await startPostgres();
    migrator = await database.connect("migrator");
    app = await database.connect("app");
    folder = await insertFolder(
      migrator,
      await topFolderId(migrator),
      "the largest folder",
    );
    await fillLargeFolder(migrator, folder);
  });

  afterAll(async () => {
    await app?.end();
    await migrator?.end();
    await database?.stop();
  });

  it("is read whole, in order, with every name at the limit", async () => {
    const answer = await getFolderView(app, folder);

    if (answer.kind !== "folder") {
      throw new Error(`Expected a folder, got "${answer.kind}"`);
    }
    expect(LARGE_FOLDER_ITEMS).toBe(4_000);
    expect(answer.view.items).toHaveLength(LARGE_FOLDER_ITEMS);
    const names = answer.view.items.map((item) => item.name);
    expect(new Set(names).size).toBe(LARGE_FOLDER_ITEMS);
    for (const name of [names[0], names[1_999], names.at(-1)] as string[]) {
      expect(Array.from(name)).toHaveLength(NAME_LIMIT);
      // Four bytes for each character.
      expect(Buffer.byteLength(name)).toBe(NAME_LIMIT * 4);
    }
    const sizes = answer.view.items.map((item) =>
      item.kind === "file" ? item.size : -1,
    );
    expect(sizes[0]).toBe(1);
    expect(sizes.at(-1)).toBe(LARGE_FOLDER_ITEMS);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it("is told unchanged without reading an item when the caller holds its version", async () => {
    expect(await getFolderView(app, folder, `"${folder}.1"`)).toEqual({
      kind: "unchanged",
      folderId: folder,
      version: 1,
    });
  });
});
