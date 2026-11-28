import { gunzipSync } from "node:zlib";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
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
import { createApp } from "../app.ts";
import type { App } from "../app.ts";
import { makeVersionTag } from "../drive/version-tag.ts";
import { httpEvent } from "../http/testing/events.ts";
import type { RequestLogEntry } from "../log/entry.ts";
import type { RequestMeasurement } from "../log/measurements.ts";

const EDGE_SECRET = "edge-secret-for-tests";
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

type Response = APIGatewayProxyStructuredResultV2;

const json = (response: Response): Record<string, unknown> =>
  JSON.parse(response.body as string) as Record<string, unknown>;

/**
 * GET /v1/folders/{folderId} through the function's entry point as the
 * server assembles it, against a real PostgreSQL and as the user "app". Every
 * test creates its own content (NFR12.24).
 */
describe("the folder operation through the server", () => {
  let postgres: TestDatabase;
  let migrator: Client;
  let top: string;
  let app: App;
  let entries: RequestLogEntry[];
  let measurements: RequestMeasurement[];
  let made = 0;

  function workFolder(name?: string): Promise<string> {
    made += 1;
    return insertFolder(migrator, top, name ?? `operation test ${made}`);
  }

  function ask(
    folderId: string,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    return app.handle(
      httpEvent({
        path: `/v1/folders/${folderId}`,
        headers: {
          "x-origin-verify": EDGE_SECRET,
          "x-request-id": "same-for-every-request",
          ...headers,
        },
      }),
    );
  }

  beforeAll(async () => {
    postgres = await startPostgres();
    migrator = await postgres.connect("migrator");
    top = await topFolderId(migrator);
    entries = [];
    measurements = [];
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
      measurements: { record: (measurement) => measurements.push(measurement) },
    });
  });

  afterEach(() => {
    entries.length = 0;
    measurements.length = 0;
  });

  afterAll(async () => {
    await app?.close();
    await migrator?.end();
    await postgres?.stop();
  });

  it("answers a folder with exactly the fields the contract names, though the folder also holds deleted items", async () => {
    const parent = await workFolder();
    const folder = await insertFolder(migrator, parent, "Circuitos I");
    const file = await insertItemDirectly(migrator, {
      kind: "file",
      parentId: folder,
      name: "prova.pdf",
      size: 1_024,
      contentType: "application/pdf",
      sourceKey: "sample:test/never-returned",
    });
    const subfolder = await insertFolder(migrator, folder, "Listas");
    await insertItemDirectly(migrator, {
      kind: "file",
      parentId: folder,
      name: "deleted.pdf",
      deleted: true,
    });
    const deletedFolder = await insertFolder(migrator, folder, "Deleted");
    await markDeleted(migrator, deletedFolder);

    const response = await ask(folder);

    expect(response.statusCode).toBe(200);
    expect(response.isBase64Encoded).toBeUndefined();
    const body = json(response);
    expect(Object.keys(body).sort()).toEqual([
      "folderId",
      "items",
      "name",
      "path",
    ]);
    expect(body).toEqual({
      folderId: folder,
      name: "Circuitos I",
      path: [
        { folderId: top, name: "All" },
        { folderId: parent, name: expect.any(String) },
        { folderId: folder, name: "Circuitos I" },
      ],
      items: [
        {
          itemId: file,
          kind: "file",
          name: "prova.pdf",
          size: 1_024,
          contentType: "application/pdf",
        },
        { itemId: subfolder, kind: "folder", name: "Listas" },
      ],
    });
    // Nothing about hidden items: no count, no mark, no position, no key.
    expect(response.body).not.toMatch(
      /deleted|position|sourceKey|source_key|contentId|sample:|version/i,
    );
    expect(response.headers).toEqual({
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-request-id": "same-for-every-request",
      etag: makeVersionTag(folder, 1),
      vary: "Accept-Encoding",
      "server-timing": expect.stringMatching(/^app;dur=\d+\.\d$/),
    });
  });

  it("answers root with the top folder under its real identifier", async () => {
    const byRoot = await ask("root");
    const byIdentifier = await ask(top);

    expect(byRoot.statusCode).toBe(200);
    expect(json(byRoot)).toMatchObject({
      folderId: top,
      name: "All",
      path: [{ folderId: top, name: "All" }],
    });
    expect(byRoot.body).toBe(byIdentifier.body);
    expect(byRoot.headers?.etag).toBe(byIdentifier.headers?.etag);
    // `root` is logged as the top folder's identifier.
    expect(entries.map((entry) => entry.folderId)).toEqual([top, top]);
  });

  it("gives the four kinds of not found the same answer byte for byte, with and without a version sent", async () => {
    const parent = await workFolder();
    const deleted = await insertFolder(migrator, parent, "deleted");
    const inside = await insertFolder(migrator, deleted, "inside");
    await markDeleted(migrator, deleted);
    const malformed = "not-an-identifier";

    const answers: Response[] = [];
    for (const folderId of [UNKNOWN, deleted, inside, malformed]) {
      answers.push(await ask(folderId));
      answers.push(
        await ask(folderId, { "if-none-match": makeVersionTag(deleted, 1) }),
      );
    }

    expect(answers).toHaveLength(8);
    for (const answer of answers) {
      expect(JSON.stringify(answer)).toBe(JSON.stringify(answers[0]));
    }
    expect(answers[0]).toEqual({
      statusCode: 404,
      headers: {
        "content-type": "application/problem+json",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-request-id": "same-for-every-request",
      },
      body: expect.any(String),
    });
    expect(json(answers[0] as Response)).toMatchObject({
      status: 404,
      code: "notFound",
    });
    // And the same as an address that is no operation at all.
    const noOperation = await app.handle(
      httpEvent({
        path: "/v1/folders",
        headers: {
          "x-origin-verify": EDGE_SECRET,
          "x-request-id": "same-for-every-request",
        },
      }),
    );
    expect(JSON.stringify(noOperation)).toBe(JSON.stringify(answers[0]));
    // The log tells malformed from the rest, and never which of the rest.
    expect(entries.slice(0, 8).map((entry) => entry.notFoundReason)).toEqual([
      "absentOrHidden",
      "absentOrHidden",
      "absentOrHidden",
      "absentOrHidden",
      "absentOrHidden",
      "absentOrHidden",
      "malformed",
      "malformed",
    ]);
  });

  it('answers "unchanged" with no content to a caller that holds the current version, also in its weak form', async () => {
    const folder = await workFolder();
    await insertItemDirectly(migrator, {
      kind: "file",
      parentId: folder,
      name: "a.txt",
    });
    const first = await ask(folder);
    const version = first.headers?.etag as string;

    const second = await ask(folder, { "if-none-match": version });
    const weak = await ask(folder, { "If-None-Match": `W/${version}` });

    expect(version).toBe(makeVersionTag(folder, 1));
    for (const response of [second, weak]) {
      expect(response).toEqual({
        statusCode: 304,
        headers: {
          etag: version,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "x-request-id": "same-for-every-request",
        },
      });
    }
  });

  it("sends the full answer again for a version that is out of date, malformed, over-long, or another folder's", async () => {
    const folder = await workFolder();
    const other = await workFolder();
    const full = await ask(folder);

    for (const held of [
      makeVersionTag(folder, 9),
      makeVersionTag(other, 1),
      "not a version",
      `${makeVersionTag(folder, 1)}${" ".repeat(200)}`,
      `${makeVersionTag(folder, 1)}, ${makeVersionTag(folder, 2)}`,
    ]) {
      const response = await ask(folder, { "if-none-match": held });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(full.body);
    }
  });

  it("answers not found, never unchanged, to a caller holding the current version of a folder whose grandparent was deleted meanwhile", async () => {
    const grandparent = await workFolder();
    const parent = await insertFolder(migrator, grandparent, "parent");
    const folder = await insertFolder(migrator, parent, "three levels down");
    const version = (await ask(folder)).headers?.etag as string;
    expect((await ask(folder, { "if-none-match": version })).statusCode).toBe(
      304,
    );

    await markDeleted(migrator, grandparent);

    const after = await ask(folder, { "if-none-match": version });
    expect(after.statusCode).toBe(404);
    expect(json(after)).toMatchObject({ code: "notFound" });
    expect(JSON.stringify(after)).toBe(JSON.stringify(await ask(UNKNOWN)));
  });

  it("shows at the second of two requests a change made to the folder between them", async () => {
    const folder = await workFolder();
    const doomed = await insertItemDirectly(migrator, {
      kind: "file",
      parentId: folder,
      name: "deleted between the requests.txt",
    });
    const first = await ask(folder);
    const held = first.headers?.etag as string;

    // What a later Unit's delete does: mark the item, raise the folder's version.
    await markDeleted(migrator, doomed);
    await migrator.query(
      "UPDATE items SET version = version + 1 WHERE id = $1",
      [folder],
    );

    const second = await ask(folder, { "if-none-match": held });
    expect((json(first).items as unknown[]).length).toBe(1);
    expect(second.statusCode).toBe(200);
    expect(json(second).items).toEqual([]);
    expect(second.headers?.etag).toBe(makeVersionTag(folder, 2));
  });

  it("marks every answer not to be stored: answered, unchanged, not found and malformed", async () => {
    const folder = await workFolder();
    const answered = await ask(folder);
    const unchanged = await ask(folder, {
      "if-none-match": answered.headers?.etag as string,
    });
    const notFound = await ask(UNKNOWN);
    const malformed = await ask("x");

    expect(
      [answered, unchanged, notFound, malformed].map(
        (response) => response.statusCode,
      ),
    ).toEqual([200, 304, 404, 404]);
    for (const response of [answered, unchanged, notFound, malformed]) {
      expect(response.headers?.["cache-control"]).toBe("no-store");
    }
  });

  it("answers the same whether or not the request carries a session or a cookie", async () => {
    const folder = await workFolder();

    const plain = await ask(folder);
    const withSession = await ask(folder, {
      authorization: "Bearer made-up-session-for-a-test",
      cookie: "session=made-up-for-a-test",
    });

    expect(withSession.statusCode).toBe(200);
    expect(withSession.body).toBe(plain.body);
    expect(withSession.headers?.etag).toBe(plain.headers?.etag);
  });

  it("answers 500 ordinary items in 150 kilobytes or less before compression, and compresses them when gzip is accepted", async () => {
    const folder = await workFolder();
    await migrator.query(
      "INSERT INTO items (kind, parent_id, name, position, version, size, content_type) SELECT $1, $2, $3 || n || $4, n, NULL, n * 1000, $5 FROM generate_series(1, 500) AS n",
      [
        "file",
        folder,
        "Lista de exercícios ",
        " - Cálculo II.pdf",
        "application/pdf",
      ],
    );

    const plain = await ask(folder);
    const compressed = await ask(folder, {
      "accept-encoding": "gzip, deflate, br",
    });

    expect((json(plain).items as unknown[]).length).toBe(500);
    expect(Buffer.byteLength(plain.body as string)).toBeLessThanOrEqual(
      150 * 1024,
    );
    expect(compressed.isBase64Encoded).toBe(true);
    expect(compressed.headers).toMatchObject({
      "content-encoding": "gzip",
      "content-type": "application/json",
      "cache-control": "no-store",
      etag: plain.headers?.etag,
    });
    const unpacked = gunzipSync(
      Buffer.from(compressed.body as string, "base64"),
    ).toString("utf8");
    expect(unpacked).toBe(plain.body);
    // As handed over, the compressed form is well under half the plain one.
    expect((compressed.body as string).length).toBeLessThan(
      (plain.body as string).length / 2,
    );
    expect(entries.map((entry) => [entry.rows, entry.answerBytes])).toEqual([
      [500, Buffer.byteLength(plain.body as string)],
      [500, Buffer.from(compressed.body as string, "base64").length],
    ]);
  });

  it("sends a small answer as it is even when gzip is accepted", async () => {
    const folder = await workFolder();

    const response = await ask(folder, { "accept-encoding": "gzip" });

    expect(response.statusCode).toBe(200);
    expect(response.isBase64Encoded).toBeUndefined();
    expect(response.headers?.["content-encoding"]).toBeUndefined();
    expect(json(response).items).toEqual([]);
  });

  it("writes one entry per request with exactly the fields of the design for each outcome, and no name", async () => {
    const folder = await workFolder("Nome que nunca vai ao registro");
    await insertItemDirectly(migrator, {
      kind: "file",
      parentId: folder,
      name: "Outro nome fora do registro.pdf",
    });
    const own = {
      time: expect.any(String),
      requestId: "same-for-every-request",
      operation: "getFolder",
      durationMs: expect.any(Number),
      version: "a1b2c3d",
      environment: "test",
      coldStart: expect.any(Boolean),
    };

    const answered = await ask(folder);
    await ask(folder, { "if-none-match": answered.headers?.etag as string });
    await ask(UNKNOWN);
    await ask("%2e%2e");

    expect(entries).toEqual([
      {
        ...own,
        level: "info",
        outcome: 200,
        folderId: folder,
        folderOutcome: "answered",
        rows: 1,
        answerBytes: Buffer.byteLength(answered.body as string),
        versionSent: false,
      },
      {
        ...own,
        level: "info",
        outcome: 304,
        folderId: folder,
        folderOutcome: "unchanged",
        versionSent: true,
      },
      {
        ...own,
        level: "info",
        outcome: 404,
        code: "notFound",
        folderId: UNKNOWN,
        folderOutcome: "notFound",
        notFoundReason: "absentOrHidden",
        versionSent: false,
      },
      {
        ...own,
        level: "info",
        outcome: 404,
        code: "notFound",
        folderOutcome: "notFound",
        notFoundReason: "malformed",
        versionSent: false,
      },
    ]);
    expect(JSON.stringify(entries)).not.toMatch(/Nome|nome|%2e/);
    // Counted like any request; none of the four is a server failure.
    expect(measurements.map((measurement) => measurement.outcome)).toEqual([
      200, 304, 404, 404,
    ]);
  });

  it("refuses unknown query parameters on a well-formed identifier, as every operation does", async () => {
    const response = await app.handle(
      httpEvent({
        path: "/v1/folders/root",
        headers: { "x-origin-verify": EDGE_SECRET },
        query: { page: "2" },
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(json(response)).toMatchObject({ code: "invalidInput" });
  });

  it("is refused like everything else when the request did not come through the edge", async () => {
    const response = await app.handle(httpEvent({ path: "/v1/folders/root" }));

    expect(response.statusCode).toBe(403);
    expect(response.body).toBeUndefined();
  });

  it("answers every folder request of a running copy over its one kept connection, in no transaction", async () => {
    const folder = await workFolder();
    const version = (await ask(folder)).headers?.etag as string;
    await ask(folder, { "if-none-match": version });
    await ask(folder, { "if-none-match": makeVersionTag(folder, 9) });
    await ask("root");
    await ask(UNKNOWN);

    const master = await postgres.connect("master");
    try {
      const connections = await master.query<{ state: string }>(
        "SELECT state FROM pg_stat_activity WHERE application_name = $1",
        ["virtuoso-drive-server"],
      );
      expect(connections.rows).toEqual([{ state: "idle" }]);
    } finally {
      await master.end();
    }
  });

  it("answers a server error within 3 seconds, with nothing partial, while the database is stopped, and recovers by itself", async () => {
    const folder = await workFolder();
    await insertItemDirectly(migrator, {
      kind: "file",
      parentId: folder,
      name: "there.txt",
    });
    expect((await ask(folder)).statusCode).toBe(200);
    // The test's own connection would be broken by the stop; it is opened again after.
    await migrator.end();

    await postgres.pause();
    let stopped: Response;
    let elapsedMs: number;
    try {
      const startedAt = Date.now();
      stopped = await ask(folder, { "accept-encoding": "gzip" });
      elapsedMs = Date.now() - startedAt;
    } finally {
      await postgres.resume();
      migrator = await postgres.connect("migrator");
    }

    expect(elapsedMs).toBeLessThan(3_100);
    expect(stopped.statusCode).toBe(500);
    expect(stopped.headers).toEqual({
      "content-type": "application/problem+json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-request-id": "same-for-every-request",
    });
    expect(json(stopped)).toMatchObject({ status: 500, code: "serverError" });
    expect(stopped.body).not.toMatch(/there\.txt|items|ECONN|SELECT/);
    expect(entries.at(-1)).toMatchObject({
      level: "error",
      outcome: 500,
      folderId: folder,
      folderOutcome: "failed",
      versionSent: false,
    });
    expect(entries.at(-1)).not.toHaveProperty("rows");

    const again = await ask(folder);
    expect(again.statusCode).toBe(200);
    expect((json(again).items as unknown[]).length).toBe(1);
  });
});
