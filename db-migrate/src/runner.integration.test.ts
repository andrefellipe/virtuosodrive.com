import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handler } from "./index.ts";
import { CREATE_USERS_FILE, MIGRATIONS_DIR } from "./paths.ts";
import { runChanges } from "./runner.ts";
import type { RunnerDependencies } from "./runner.ts";
import { giveTestPassword, startPostgres } from "./testing/postgres.ts";
import type { TestDatabase } from "./testing/postgres.ts";

// The change runner against a database as a new environment has it: no users
// "app" or "migrator" yet. Amazon RDS provides the role "rds_iam"; the test
// creates it, and gives "migrator" a password once it exists, because a plain
// PostgreSQL cannot check AWS identities.
describe("the change runner in a new environment", () => {
  let database: TestDatabase;
  let masterSignIns: number;
  let messages: string[];

  function dependencies(
    overrides: Partial<RunnerDependencies> = {},
  ): RunnerDependencies {
    masterSignIns = 0;
    messages = [];
    return {
      async connectAsMigrator() {
        const master = await database.connect("master");
        try {
          await giveTestPassword(
            master,
            "migrator",
            database.passwords.migrator,
          );
        } finally {
          await master.end();
        }
        return database.connect("migrator");
      },
      connectAsMaster() {
        masterSignIns += 1;
        return database.connect("master");
      },
      migrationsDir: MIGRATIONS_DIR,
      createUsersSql: readFileSync(CREATE_USERS_FILE, "utf8"),
      log: (message) => messages.push(message),
      ...overrides,
    };
  }

  beforeAll(async () => {
    database = await startPostgres({ createUsers: false });
    const master = await database.connect("master");
    try {
      await master.query("CREATE ROLE rds_iam NOLOGIN");
    } finally {
      await master.end();
    }
  });

  afterAll(async () => {
    await database?.stop();
  });

  it("creates the users first, then applies the first change", async () => {
    const report = await runChanges(dependencies());

    expect(report).toEqual({
      createdUsers: true,
      applied: ["0001_site-information"],
    });
    expect(masterSignIns).toBe(1);
    expect(messages.join("\n")).toContain("new environment");

    const master = await database.connect("master");
    try {
      const members = await master.query<{ member: string }>(
        "SELECT m.rolname AS member FROM pg_auth_members a JOIN pg_roles r ON r.oid = a.roleid JOIN pg_roles m ON m.oid = a.member WHERE r.rolname = $1 ORDER BY m.rolname",
        ["rds_iam"],
      );
      expect(members.rows.map((row) => row.member)).toEqual([
        "app",
        "migrator",
      ]);
      const owner = await master.query<{ tableowner: string }>(
        "SELECT tableowner FROM pg_tables WHERE tablename = $1",
        ["site_information"],
      );
      expect(owner.rows[0]?.tableowner).toBe("migrator");
    } finally {
      await master.end();
    }
  });

  it("applies nothing and never uses the master sign-in when run again", async () => {
    const report = await runChanges(dependencies());

    expect(report).toEqual({ createdUsers: false, applied: [] });
    expect(masterSignIns).toBe(0);
  });

  it("stops without creating anything when migrator exists but its sign-in is refused", async () => {
    const refused = Object.assign(new Error("PAM authentication failed"), {
      code: "28000",
    });

    await expect(
      runChanges(
        dependencies({ connectAsMigrator: () => Promise.reject(refused) }),
      ),
    ).rejects.toThrow(/"migrator" exists but could not sign in/);
    expect(masterSignIns).toBe(1);
  });

  it("fails without using the master sign-in when the database cannot be reached", async () => {
    const unreachable = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });

    await expect(
      runChanges(
        dependencies({ connectAsMigrator: () => Promise.reject(unreachable) }),
      ),
    ).rejects.toBe(unreachable);
    expect(masterSignIns).toBe(0);
  });

  it("refuses to start as a function when its settings are missing", async () => {
    await expect(handler()).rejects.toThrow(/settings are missing/);
  });
});
