import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startPostgres } from "../../../db-migrate/src/testing/postgres.ts";
import type { TestDatabase } from "../../../db-migrate/src/testing/postgres.ts";
import { Database } from "./database.ts";
import type { DatabaseSettings } from "./database.ts";
import { getSiteInformation, ping } from "./site-information.ts";

const WRONG_PASSWORD = "28P01";

async function waitUntil(
  condition: () => boolean,
  what: string,
): Promise<void> {
  const givenUpAt = Date.now() + 5_000;
  while (!condition()) {
    if (Date.now() > givenUpAt) {
      throw new Error(`Timed out waiting until ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("database access", () => {
  let postgres: TestDatabase;
  let settings: DatabaseSettings;
  const opened: Database[] = [];

  function connectAsApp(overrides: Partial<DatabaseSettings> = {}): Database {
    const database = new Database({ ...settings, ...overrides }, () =>
      Promise.resolve(postgres.passwords.app),
    );
    opened.push(database);
    return database;
  }

  beforeAll(async () => {
    postgres = await startPostgres();
    settings = {
      host: postgres.host,
      port: postgres.port,
      database: postgres.database,
      user: "app",
      caCertificate: postgres.caCertificate,
    };
  });

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((database) => database.close()));
  });

  afterAll(async () => {
    await postgres?.stop();
  });

  it("reads the site information row and answers the health read over one kept connection", async () => {
    const database = connectAsApp();
    const startedAt = Date.now();

    const information = await getSiteInformation(database);
    await ping(database);
    await getSiteInformation(database);

    expect(information?.installedAt).toBeInstanceOf(Date);
    expect(information?.installedAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(information?.installedAt.getTime()).toBeGreaterThan(
      startedAt - 10 * 60_000,
    );
    expect(database.connectionsOpened).toBe(1);
  });

  it("reopens a connection found broken before the statement is sent, once", async () => {
    const database = connectAsApp();
    await ping(database);

    const master = await postgres.connect("master");
    try {
      await master.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = $1",
        ["app"],
      );
    } finally {
      await master.end();
    }
    await waitUntil(
      () => database.connectionBroken,
      "the kept connection is seen as broken",
    );

    await expect(getSiteInformation(database)).resolves.toBeDefined();
    expect(database.connectionsOpened).toBe(2);
  });

  it("does not try a second time when the one reopen fails", async () => {
    let tokensAsked = 0;
    const database = new Database(settings, () => {
      tokensAsked += 1;
      return Promise.resolve("not-the-token");
    });
    opened.push(database);

    await expect(ping(database)).rejects.toMatchObject({
      code: WRONG_PASSWORD,
    });
    expect(tokensAsked).toBe(1);
    expect(database.connectionsOpened).toBe(0);
  });

  it("refuses a database whose certificate comes from another authority", async () => {
    const database = connectAsApp({
      caCertificate: postgres.unrelatedCaCertificate,
    });

    await expect(ping(database)).rejects.toMatchObject({
      code: expect.stringMatching(/SELF_SIGNED|UNABLE_TO_VERIFY|CERT/),
    });
    expect(database.connectionsOpened).toBe(0);
  });

  it("fails within 3 seconds while the database is stopped and recovers on the next request after it restarts", async () => {
    const database = connectAsApp();
    await ping(database);

    await postgres.pause();
    try {
      const startedAt = Date.now();
      await expect(getSiteInformation(database)).rejects.toThrow();
      expect(Date.now() - startedAt).toBeLessThan(3_100);

      const secondStartedAt = Date.now();
      await expect(ping(database)).rejects.toThrow();
      expect(Date.now() - secondStartedAt).toBeLessThan(3_100);
    } finally {
      await postgres.resume();
    }

    await expect(getSiteInformation(database)).resolves.toBeDefined();
    await expect(ping(database)).resolves.toBeUndefined();
  });
});
