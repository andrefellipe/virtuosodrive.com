import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, MIGRATIONS_TABLE } from "./apply-migrations.ts";
import { MIGRATIONS_DIR } from "./paths.ts";
import { startPostgres } from "./testing/postgres.ts";
import type { TestDatabase } from "./testing/postgres.ts";

const FIRST_CHANGE = "0001_site-information";
const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

describe("database changes", () => {
  let database: TestDatabase;
  let firstRun: string[];

  beforeAll(async () => {
    database = await startPostgres({ migrate: false });
    const migrator = await database.connect("migrator");
    try {
      firstRun = await applyMigrations(
        migrator,
        MIGRATIONS_DIR,
        () => undefined,
      );
    } finally {
      await migrator.end();
    }
  });

  afterAll(async () => {
    await database?.stop();
  });

  it("apply to an empty database and are recorded", async () => {
    expect(firstRun).toEqual([FIRST_CHANGE]);

    const migrator = await database.connect("migrator");
    try {
      const recorded = await migrator.query<{ name: string }>(
        "SELECT name FROM pgmigrations ORDER BY id",
      );
      expect(MIGRATIONS_TABLE).toBe("pgmigrations");
      expect(recorded.rows.map((row) => row.name)).toEqual([FIRST_CHANGE]);

      const rows = await migrator.query<{ id: number; installed_at: Date }>(
        "SELECT id, installed_at FROM site_information",
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]?.id).toBe(1);
      expect(rows.rows[0]?.installed_at).toBeInstanceOf(Date);
    } finally {
      await migrator.end();
    }
  });

  it("change nothing when applied again", async () => {
    const migrator = await database.connect("migrator");
    try {
      const before = await migrator.query<{ installed_at: Date }>(
        "SELECT installed_at FROM site_information",
      );
      const secondRun = await applyMigrations(
        migrator,
        MIGRATIONS_DIR,
        () => undefined,
      );
      const after = await migrator.query<{ installed_at: Date }>(
        "SELECT installed_at FROM site_information",
      );
      const recorded = await migrator.query("SELECT name FROM pgmigrations");

      expect(secondRun).toEqual([]);
      expect(recorded.rowCount).toBe(1);
      expect(after.rows[0]?.installed_at).toEqual(before.rows[0]?.installed_at);
    } finally {
      await migrator.end();
    }
  });

  it("refuse a second row in site_information", async () => {
    const migrator = await database.connect("migrator");
    try {
      await expect(
        migrator.query("INSERT INTO site_information (id) VALUES ($1)", [2]),
      ).rejects.toMatchObject({ code: CHECK_VIOLATION });
      await expect(
        migrator.query("INSERT INTO site_information (id) VALUES ($1)", [1]),
      ).rejects.toMatchObject({ code: UNIQUE_VIOLATION });

      const rows = await migrator.query("SELECT id FROM site_information");
      expect(rows.rowCount).toBe(1);
    } finally {
      await migrator.end();
    }
  });

  it("let the user app read the row but not change it or the table", async () => {
    const app = await database.connect("app");
    try {
      const rows = await app.query<{ id: number }>(
        "SELECT id FROM site_information WHERE id = $1",
        [1],
      );
      expect(rows.rows).toEqual([{ id: 1 }]);

      await expect(
        app.query("ALTER TABLE site_information ADD COLUMN extra text"),
      ).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
      await expect(
        app.query("DROP TABLE site_information"),
      ).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
      await expect(
        app.query("UPDATE site_information SET installed_at = now()"),
      ).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
      await expect(
        app.query("CREATE TABLE made_by_app (id int)"),
      ).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
    } finally {
      await app.end();
    }
  });
});
