import { describe, expect, it } from "vitest";
import type { Database } from "../db/database.ts";
import { DeadlineExceededError } from "../db/deadline.ts";
import { PathTooDeepError } from "../drive/store-errors.ts";
import { OriginSecretVerifier } from "../http/origin-secret.ts";
import { createRequestHandler } from "../http/request-steps.ts";
import { httpEvent } from "../http/testing/events.ts";
import type { RequestLogEntry } from "../log/entry.ts";
import { folderOperation } from "./folder.ts";

const EDGE_SECRET = "edge-secret-for-tests";
const FOLDER = "3f2b8c1e-9a4d-4e6f-8b7a-0c1d2e3f4a5b";
const A_NAME = "Prova final do Fulano.pdf";

/**
 * The folder operation when its database access fails, and before it is
 * asked at all. Here the access is one that fails or is never reached; it is
 * not a stand-in for the database. Every answer that needs the database is
 * tested against a real PostgreSQL in folder.integration.test.ts.
 */
function setUp(failure?: unknown) {
  const entries: RequestLogEntry[] = [];
  let asked = 0;
  const access = {
    run: () => {
      asked += 1;
      return Promise.reject(failure ?? new Error("not expected to be asked"));
    },
  } as unknown as Database;
  const handler = createRequestHandler({
    operations: [folderOperation(access, { now: () => 0 })],
    originSecret: new OriginSecretVerifier(() => Promise.resolve(EDGE_SECRET)),
    log: { write: (entry) => entries.push(entry) },
    measurements: { record: () => undefined },
    environment: "test",
    version: "a1b2c3d",
    takeColdStart: () => false,
    now: () => 1_000,
    generateRequestId: () => "generated-id",
  });
  const ask = (folderId: string, headers: Record<string, string> = {}) =>
    handler(
      httpEvent({
        path: `/v1/folders/${folderId}`,
        headers: { "x-origin-verify": EDGE_SECRET, ...headers },
      }),
    );
  return { ask, entries, asked: () => asked };
}

describe("the folder operation", () => {
  it("declares a GET with one path value, two request headers and the log fields of the design", () => {
    const operation = folderOperation({} as Database);

    expect(operation).toMatchObject({
      name: "getFolder",
      method: "GET",
      path: "/v1/folders/{folderId}",
      headers: ["if-none-match", "x-accept-gzip"],
      logFields: {
        folderId: "string",
        folderOutcome: "string",
        notFoundReason: "string",
        rows: "number",
        answerBytes: "number",
        versionSent: "boolean",
      },
    });
    expect(operation.healthCheck).toBeUndefined();
  });

  it.each([
    ["markup", "%3Cscript%3E"],
    ["a path fragment", ".."],
    ["a query fragment", "x'%20OR%20'1'='1"],
    ["a value of 10,000 characters", "a".repeat(10_000)],
    ["an identifier in upper case", FOLDER.toUpperCase()],
    ["Root with a capital", "Root"],
  ])(
    "answers not found for %s without asking the database, and logs neither the value nor an identifier",
    async (_what, sent) => {
      const { ask, entries, asked } = setUp();

      const response = await ask(sent);

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body as string)).toMatchObject({
        code: "notFound",
      });
      expect(asked()).toBe(0);
      expect(entries).toEqual([
        {
          time: new Date(1_000).toISOString(),
          level: "info",
          requestId: "generated-id",
          operation: "getFolder",
          outcome: 404,
          code: "notFound",
          durationMs: 0,
          version: "a1b2c3d",
          environment: "test",
          coldStart: false,
          folderOutcome: "notFound",
          notFoundReason: "malformed",
          versionSent: false,
        },
      ]);
    },
  );

  it("says in the entry whether a version was sent, also for a malformed identifier", async () => {
    const { ask, entries } = setUp();

    await ask("not-an-identifier", { "if-none-match": `"${FOLDER}.1"` });

    expect(entries[0]).toMatchObject({
      notFoundReason: "malformed",
      versionSent: true,
    });
    expect(entries[0]).not.toHaveProperty("folderId");
  });

  it("answers a server error with the outcome failed and the folder's identifier when the database does not answer", async () => {
    const { ask, entries } = setUp(
      new DeadlineExceededError("The database request", 3_000),
    );

    const response = await ask(FOLDER, { "if-none-match": `"${FOLDER}.4"` });

    expect(response.statusCode).toBe(500);
    expect(response.headers?.["cache-control"]).toBe("no-store");
    expect(response.body).not.toContain("3000");
    expect(entries[0]).toEqual({
      time: new Date(1_000).toISOString(),
      level: "error",
      requestId: "generated-id",
      operation: "getFolder",
      outcome: 500,
      code: "serverError",
      durationMs: 0,
      version: "a1b2c3d",
      environment: "test",
      coldStart: false,
      folderId: FOLDER,
      folderOutcome: "failed",
      versionSent: true,
      error: {
        name: "DeadlineExceededError",
        message: "The database request did not finish within 3000 ms",
        stack: expect.any(String),
      },
    });
  });

  it("does not log an identifier for root when the read fails before the top folder's is known", async () => {
    const { ask, entries } = setUp(new Error("connection lost"));

    await ask("root");

    expect(entries[0]).toMatchObject({ outcome: 500, folderOutcome: "failed" });
    expect(entries[0]).not.toHaveProperty("folderId");
  });

  it("names the fault pathTooDeep with the folder's identifier", async () => {
    const { ask, entries } = setUp(new PathTooDeepError(FOLDER, 64));

    const response = await ask(FOLDER);

    expect(response.statusCode).toBe(500);
    expect(entries[0]).toMatchObject({
      level: "error",
      fault: "pathTooDeep",
      folderId: FOLDER,
      folderOutcome: "failed",
      error: { message: expect.stringContaining("64 levels") },
    });
  });

  it("leaves no name in the entry when the database's error message holds one", async () => {
    const databaseError = Object.assign(
      new Error(`value too long for "${A_NAME}"`),
      {
        code: "22001",
        detail: `Failing row contains (${A_NAME}).`,
        where: `while reading ${A_NAME}`,
      },
    );
    const { ask, entries } = setUp(databaseError);

    const response = await ask(FOLDER);

    expect(response.statusCode).toBe(500);
    expect(entries[0]).toMatchObject({
      outcome: 500,
      folderOutcome: "failed",
      error: {
        name: "OperationFailure",
        message: "The database failed the folder read: code 22001",
      },
    });
    expect(JSON.stringify(entries)).not.toContain("Fulano");
    expect(JSON.stringify(response)).not.toContain("Fulano");
  });
});
