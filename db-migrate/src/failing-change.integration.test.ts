import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REHEARSAL_MESSAGE } from "./apply-migrations.ts";
import { CREATE_USERS_FILE, MIGRATIONS_DIR, REHEARSAL_DIR } from "./paths.ts";
import { runChanges } from "./runner.ts";
import type { RunnerDependencies } from "./runner.ts";
import { changeNames } from "./testing/changes.ts";
import { startPostgres } from "./testing/postgres.ts";
import type { TestDatabase } from "./testing/postgres.ts";

const REHEARSAL_THAT_DOES_NOT_FAIL = fileURLToPath(
  new URL("./testing/fixtures/rehearsal-that-does-not-fail", import.meta.url),
);

interface Snapshot {
  recorded: string[];
  siteInformation: { id: number; installed_at: Date }[];
  tables: string[];
}

// The rehearsal of a failing deployment: with the switch on, the change
// runner applies the real pending changes and then one change that fails on
// purpose. The tests run in order against one database, as the rehearsal's
// deployments do against the test environment's.
describe("the change runner with the failing change switched on", () => {
  let database: TestDatabase;
  let afterTheFirstFailure: Snapshot;

  function dependencies(rehearsalDir?: string): RunnerDependencies {
    return {
      connectAsMigrator: () => database.connect("migrator"),
      connectAsMaster: () =>
        Promise.reject(new Error("The master sign-in must not be used here")),
      migrationsDir: MIGRATIONS_DIR,
      createUsersSql: readFileSync(CREATE_USERS_FILE, "utf8"),
      ...(rehearsalDir === undefined ? {} : { rehearsalDir }),
      log: () => undefined,
    };
  }

  async function snapshot(): Promise<Snapshot> {
    const master = await database.connect("master");
    try {
      const recorded = await master.query<{ name: string }>(
        "SELECT name FROM pgmigrations ORDER BY id",
      );
      const siteInformation = await master.query<{
        id: number;
        installed_at: Date;
      }>("SELECT id, installed_at FROM site_information ORDER BY id");
      const tables = await master.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename",
        ["public"],
      );
      return {
        recorded: recorded.rows.map((row) => row.name),
        siteInformation: siteInformation.rows,
        tables: tables.rows.map((row) => row.tablename),
      };
    } finally {
      await master.end();
    }
  }

  beforeAll(async () => {
    // The users exist; no change has been applied yet.
    database = await startPostgres({ migrate: false });
  });

  afterAll(async () => {
    await database?.stop();
  });

  it("fails with the rehearsal's message, after the real pending changes, which stay applied", async () => {
    await expect(runChanges(dependencies(REHEARSAL_DIR))).rejects.toThrow(
      REHEARSAL_MESSAGE,
    );

    afterTheFirstFailure = await snapshot();
    // Only the real changes are recorded: each was committed by itself
    // before the failing one was tried.
    expect(afterTheFirstFailure.recorded).toEqual(changeNames());
    expect(afterTheFirstFailure.siteInformation).toHaveLength(1);
    expect(afterTheFirstFailure.siteInformation[0]?.id).toBe(1);
  });

  it("fails again when nothing real is pending, recording nothing and changing nothing", async () => {
    await expect(runChanges(dependencies(REHEARSAL_DIR))).rejects.toThrow(
      REHEARSAL_MESSAGE,
    );

    expect(await snapshot()).toEqual(afterTheFirstFailure);
  });

  it("takes its record out again, and still fails, if the rehearsal's change does not fail", async () => {
    await expect(
      runChanges(dependencies(REHEARSAL_THAT_DOES_NOT_FAIL)),
    ).rejects.toThrow(/did not fail \(9999_does-not-fail\)/);

    expect(await snapshot()).toEqual(afterTheFirstFailure);
  });

  it("succeeds, applying nothing, in the next run with the switch off", async () => {
    const report = await runChanges(dependencies());

    expect(report).toEqual({ createdUsers: false, applied: [] });
    expect(await snapshot()).toEqual(afterTheFirstFailure);
  });

  it("keeps the failing change in a folder of its own, where no ordinary run finds it", () => {
    const rehearsalFiles = readdirSync(REHEARSAL_DIR);

    expect(rehearsalFiles).toEqual(["9999_rehearsal-fails.sql"]);
    expect(
      readFileSync(join(REHEARSAL_DIR, "9999_rehearsal-fails.sql"), "utf8"),
    ).toContain(`RAISE EXCEPTION '${REHEARSAL_MESSAGE}'`);
    expect(REHEARSAL_DIR.startsWith(MIGRATIONS_DIR)).toBe(false);
    expect(changeNames().some((name) => name.includes("rehearsal"))).toBe(
      false,
    );
  });
});
