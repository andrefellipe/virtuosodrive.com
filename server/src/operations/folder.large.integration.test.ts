import { gunzipSync } from "node:zlib";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  insertFolder,
  topFolderId,
} from "../../../db-migrate/src/testing/items.ts";
import { startPostgres } from "../../../db-migrate/src/testing/postgres.ts";
import type { TestDatabase } from "../../../db-migrate/src/testing/postgres.ts";
import { createApp } from "../app.ts";
import type { App } from "../app.ts";
import {
  fillLargeFolder,
  LARGE_FOLDER_ITEMS,
} from "../drive/testing/large-folder.ts";
import { ANSWER_LIMIT_BYTES } from "../http/request-steps.ts";
import { httpEvent } from "../http/testing/events.ts";
import type { RequestLogEntry } from "../log/entry.ts";

const EDGE_SECRET = "edge-secret-for-tests";

/**
 * The guarantee of scalability design C21, through the function's entry
 * point: 4,000 items with 255-character names of four-byte characters are
 * answered, and the response handed to the platform is under 5.5 megabytes
 * whether or not the caller sends X-Accept-Gzip. Slow, so not in the quick run.
 */
describe("the folder operation with 4,000 items of the longest names", () => {
  let postgres: TestDatabase;
  let migrator: Client;
  let app: App;
  let folder: string;
  const entries: RequestLogEntry[] = [];

  const ask = (headers: Record<string, string> = {}) =>
    app.handle(
      httpEvent({
        path: `/v1/folders/${folder}`,
        headers: { "x-origin-verify": EDGE_SECRET, ...headers },
      }),
    );

  beforeAll(async () => {
    postgres = await startPostgres();
    migrator = await postgres.connect("migrator");
    folder = await insertFolder(
      migrator,
      await topFolderId(migrator),
      "the largest folder",
    );
    await fillLargeFolder(migrator, folder);
    app = createApp({
      config: {
        environment: "test",
        version: "a1b2c3d",
        region: "us-east-1",
        database: {
          host: postgres.host,
          port: postgres.port,
          name: postgres.database,
          user: "app",
        },
        originSecretId: "vd-test-origin-secret",
        forcedFailure: false,
      },
      databaseCa: postgres.caCertificate,
      databaseToken: () => Promise.resolve(postgres.passwords.app),
      readOriginSecret: () => Promise.resolve(EDGE_SECRET),
      log: { write: (entry) => entries.push(entry) },
      measurements: { record: () => undefined },
    });
  });

  afterAll(async () => {
    await app?.close();
    await migrator?.end();
    await postgres?.stop();
  });

  it("is handed over plain, under 5.5 megabytes, to a caller that does not send X-Accept-Gzip", async () => {
    // The standard header is not read: sending it changes nothing.
    const response = await ask({ "accept-encoding": "gzip" });

    expect(response.statusCode).toBe(200);
    expect(response.isBase64Encoded).toBeUndefined();
    const handedOver = Buffer.byteLength(JSON.stringify(response));
    // More than 4 megabytes of names: the test is of the size it claims.
    expect(handedOver).toBeGreaterThan(4 * 1024 * 1024);
    expect(handedOver).toBeLessThan(ANSWER_LIMIT_BYTES);
    const body = JSON.parse(response.body as string) as { items: unknown[] };
    expect(body.items).toHaveLength(LARGE_FOLDER_ITEMS);
    expect(entries.at(-1)).toMatchObject({
      outcome: 200,
      folderOutcome: "answered",
      rows: LARGE_FOLDER_ITEMS,
    });
    expect(entries.at(-1)).not.toHaveProperty("fault");
  });

  it("is handed over compressed, under 5.5 megabytes, and unpacks to the same list, for a caller that sends X-Accept-Gzip: 1", async () => {
    const plain = await ask();
    const compressed = await ask({ "x-accept-gzip": "1" });

    expect(compressed.statusCode).toBe(200);
    expect(compressed.isBase64Encoded).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(compressed))).toBeLessThan(
      ANSWER_LIMIT_BYTES,
    );
    expect(
      gunzipSync(Buffer.from(compressed.body as string, "base64")).toString(
        "utf8",
      ),
    ).toBe(plain.body);
  });
});
