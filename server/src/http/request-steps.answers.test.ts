import { gunzipSync, gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { RequestLogEntry } from "../log/entry.ts";
import type { RequestMeasurement } from "../log/measurements.ts";
import {
  defineOperation,
  findOperationFor,
  matchPath,
  pathParameterNames,
} from "./operation.ts";
import type {
  DeclaredHeaders,
  Operation,
  OperationResult,
} from "./operation.ts";
import { OriginSecretVerifier } from "./origin-secret.ts";
import { OperationFailure } from "./problem.ts";
import { ANSWER_LIMIT_BYTES, createRequestHandler } from "./request-steps.ts";
import { httpEvent } from "./testing/events.ts";

const EDGE_SECRET = "edge-secret-for-tests";
const FROM_EDGE = { "x-origin-verify": EDGE_SECRET };

/**
 * What U3 changed in the request steps (logical components, changes 1 to 5):
 * named parts in a path, declared headers, "not found" for a failed check of
 * path values, answers with headers, with no body and compressed, the size
 * limit, and fields an operation adds to its entry. U1's own tests of the
 * steps are in request-steps.test.ts and are unchanged.
 */
function setUp(answer: (thingId: string) => OperationResult | Promise<never>) {
  const entries: RequestLogEntry[] = [];
  const measurements: RequestMeasurement[] = [];
  const seen: { params: unknown; headers: DeclaredHeaders }[] = [];

  const operations: Operation[] = [
    defineOperation({
      name: "getThing",
      method: "GET",
      path: "/v1/things/{thingId}",
      query: z.strictObject({}),
      params: z.strictObject({ thingId: z.string().regex(/^[a-z]{1,8}$/) }),
      invalidParams: {
        problem: "notFound",
        log: (headers) => ({
          thingOutcome: "notFound",
          versionSent: headers["if-none-match"] !== undefined,
        }),
      },
      headers: ["if-none-match", "Accept-Encoding"],
      logFields: {
        thingId: "string",
        thingOutcome: "string",
        versionSent: "boolean",
        answerBytes: "number",
      },
      failureLog: { thingOutcome: "failed" },
      run: async ({ params, headers, log }) => {
        seen.push({ params, headers });
        log({ thingId: params.thingId, neverDeclared: "dropped" });
        return answer(params.thingId);
      },
    }),
    defineOperation({
      name: "getStrict",
      method: "GET",
      path: "/v1/strict/{strictId}/parts/{partId}",
      query: z.strictObject({}),
      params: z.strictObject({
        strictId: z.string().regex(/^[0-9]+$/),
        partId: z.string().min(1),
      }),
      run: async ({ params }) => ({ status: 200, body: params }),
    }),
    defineOperation({
      name: "getPlain",
      method: "GET",
      path: "/v1/plain",
      query: z.strictObject({}),
      run: async ({ headers, params }) => ({
        status: 200,
        body: { headers, params },
      }),
    }),
  ];

  const handler = createRequestHandler({
    operations,
    originSecret: new OriginSecretVerifier(() => Promise.resolve(EDGE_SECRET)),
    log: { write: (entry) => entries.push(entry) },
    measurements: { record: (measurement) => measurements.push(measurement) },
    environment: "test",
    version: "a1b2c3d",
    takeColdStart: () => false,
    now: () => 1_000,
    generateRequestId: () => "generated-id",
  });
  const ask = (path: string, headers: Record<string, string> = {}) =>
    handler(httpEvent({ path, headers: { ...FROM_EDGE, ...headers } }));
  return { ask, entries, measurements, seen, operations };
}

const ok = (): OperationResult => ({ status: 200, body: { ok: true } });

describe("a path with named parts (change 1)", () => {
  it("matches an address with one part in the named part's place, and hands the value over", () => {
    expect(matchPath("/v1/things/{thingId}", "/v1/things/abc")).toEqual({
      thingId: "abc",
    });
    expect(
      matchPath("/v1/strict/{strictId}/parts/{partId}", "/v1/strict/7/parts/x"),
    ).toEqual({ strictId: "7", partId: "x" });
    expect(pathParameterNames("/v1/strict/{strictId}/parts/{partId}")).toEqual([
      "strictId",
      "partId",
    ]);
  });

  it("does not match an address with the part missing, empty, or made of two parts", () => {
    for (const path of [
      "/v1/things",
      "/v1/things/",
      "/v1/things/a/b",
      "/v1/thing/abc",
      "/v2/things/abc",
    ]) {
      expect(matchPath("/v1/things/{thingId}", path)).toBeUndefined();
    }
  });

  it("still matches a path without named parts only when it is exactly equal", () => {
    expect(matchPath("/v1/plain", "/v1/plain")).toEqual({});
    expect(matchPath("/v1/plain", "/v1/plain/")).toBeUndefined();
    expect(matchPath("/v1/plain", "/v1/Plain")).toBeUndefined();
    expect(pathParameterNames("/v1/plain")).toEqual([]);
  });

  it("finds the operation by method and path, with the values not yet checked", () => {
    const { operations } = setUp(ok);

    expect(
      findOperationFor(operations, "GET", "/v1/things/NOT-CHECKED-YET"),
    ).toMatchObject({
      operation: { name: "getThing" },
      pathValues: { thingId: "NOT-CHECKED-YET" },
    });
    expect(
      findOperationFor(operations, "POST", "/v1/things/abc"),
    ).toBeUndefined();
    expect(findOperationFor(operations, "GET", "/v1/things")).toBeUndefined();
  });

  it("runs the operation with the checked values of its path", async () => {
    const { ask, seen } = setUp(ok);

    const response = await ask("/v1/things/abc");
    const two = await ask("/v1/strict/42/parts/left");

    expect(response.statusCode).toBe(200);
    expect(seen[0]?.params).toEqual({ thingId: "abc" });
    expect(JSON.parse(two.body as string)).toEqual({
      strictId: "42",
      partId: "left",
    });
  });
});

describe("what an operation is given (change 2)", () => {
  it("hands over the headers it declared, whatever the case of their names, and no other", async () => {
    const { ask, seen } = setUp(ok);

    await ask("/v1/things/abc", {
      "If-None-Match": '"abc.1"',
      "accept-encoding": "gzip",
      cookie: "session=secret",
      authorization: "Bearer secret",
      "x-forwarded-for": "192.0.2.7",
    });

    expect(seen[0]?.headers).toEqual({
      "if-none-match": '"abc.1"',
      "accept-encoding": "gzip",
    });
  });

  it("hands a declared header that was not sent over as undefined, and an operation that declares none gets none", async () => {
    const { ask, seen } = setUp(ok);

    await ask("/v1/things/abc");
    const plain = await ask("/v1/plain", { "if-none-match": '"x.1"' });

    expect(seen[0]?.headers).toEqual({
      "if-none-match": undefined,
      "accept-encoding": undefined,
    });
    expect(JSON.parse(plain.body as string)).toEqual({
      headers: {},
      params: {},
    });
  });
});

describe("a failed check of the path's values (change 3)", () => {
  it("is answered invalidInput by default, without running the operation", async () => {
    const { ask, entries } = setUp(ok);

    const response = await ask("/v1/strict/not-a-number/parts/x");

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body as string)).toMatchObject({
      code: "invalidInput",
    });
    expect(entries[0]).toMatchObject({ operation: "getStrict", outcome: 400 });
  });

  it("is answered not found when the operation declares so, with the same answer as an unknown address", async () => {
    const { ask, entries, seen } = setUp(ok);

    const malformed = await ask("/v1/things/NOT-LOWER-CASE", {
      "if-none-match": '"abc.1"',
    });
    const unknownAddress = await ask("/v1/nowhere");

    expect(malformed.statusCode).toBe(404);
    expect(malformed).toEqual(unknownAddress);
    expect(seen).toEqual([]);
    // What the operation declared for this case is in the entry; the value sent is not.
    expect(entries[0]).toEqual({
      time: new Date(1_000).toISOString(),
      level: "info",
      requestId: "generated-id",
      operation: "getThing",
      outcome: 404,
      code: "notFound",
      durationMs: 0,
      version: "a1b2c3d",
      environment: "test",
      coldStart: false,
      thingOutcome: "notFound",
      versionSent: true,
    });
    expect(JSON.stringify(entries)).not.toContain("NOT-LOWER-CASE");
  });
});

describe("what an operation may answer (change 4)", () => {
  it("sends the headers the operation names, which cannot replace the fixed ones", async () => {
    const { ask } = setUp(() => ({
      status: 200,
      body: { ok: true },
      headers: {
        ETag: '"abc.3"',
        "Server-Timing": "app;dur=1.5",
        "Cache-Control": "public, max-age=3600",
        "X-Request-Id": "forged",
        "Content-Type": "text/html",
      },
    }));

    const response = await ask("/v1/things/abc", { "x-request-id": "page-1" });

    expect(response.headers).toEqual({
      etag: '"abc.3"',
      "server-timing": "app;dur=1.5",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-type": "application/json",
      "x-request-id": "page-1",
    });
  });

  it("sends an answer with no body: no content, no content type, still not to be stored", async () => {
    const { ask, measurements } = setUp(() => ({
      status: 304,
      headers: { etag: '"abc.3"' },
    }));

    const response = await ask("/v1/things/abc");

    expect(response).toEqual({
      statusCode: 304,
      headers: {
        etag: '"abc.3"',
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-request-id": "generated-id",
      },
    });
    // 304 is no server failure (observability design O21).
    expect(measurements).toEqual([
      { outcome: 304, durationMs: 0, coldStart: false },
    ]);
  });

  it("sends JSON text the operation prepared exactly as written", async () => {
    const text = '{"spaced":   "as written"}';
    const { ask } = setUp(() => ({
      status: 200,
      prepared: { encoding: "identity", text },
    }));

    const response = await ask("/v1/things/abc");

    expect(response.body).toBe(text);
    expect(response.isBase64Encoded).toBeUndefined();
    expect(response.headers?.["content-type"]).toBe("application/json");
    expect(response.headers?.["content-encoding"]).toBeUndefined();
  });

  it("passes a compressed body on in the encoded form the platform requires", async () => {
    const text = JSON.stringify({
      items: Array.from({ length: 50 }, () => "x"),
    });
    const { ask } = setUp(() => ({
      status: 200,
      prepared: { encoding: "gzip", bytes: gzipSync(text) },
      headers: { vary: "Accept-Encoding" },
    }));

    const response = await ask("/v1/things/abc");

    expect(response.isBase64Encoded).toBe(true);
    expect(response.headers).toMatchObject({
      "content-encoding": "gzip",
      "content-type": "application/json",
      "cache-control": "no-store",
      vary: "Accept-Encoding",
    });
    expect(
      gunzipSync(Buffer.from(response.body as string, "base64")).toString(),
    ).toBe(text);
  });

  it("answers a failure the operation states on purpose as that Problem, with no error in the entry", async () => {
    const { ask, entries, measurements } = setUp(() => ({
      problem: "notFound",
      log: { thingOutcome: "notFound" },
    }));

    const response = await ask("/v1/things/abc");
    const unknownAddress = await ask("/v1/nowhere");

    expect(response).toEqual(unknownAddress);
    expect(entries[0]).toMatchObject({
      level: "info",
      outcome: 404,
      code: "notFound",
      thingId: "abc",
      thingOutcome: "notFound",
    });
    expect(entries[0]).not.toHaveProperty("error");
    // 404 is no server failure.
    expect(measurements[0]?.outcome).toBe(404);
  });
});

describe("the size limit of an answer (scalability design C21)", () => {
  const bodyOf = (bytes: number) => "a".repeat(bytes);

  it("refuses a response of over 5.5 megabytes as handed over, with a small server error and the fault answerTooLarge", async () => {
    const { ask, entries, measurements } = setUp(() => ({
      status: 200,
      prepared: { encoding: "identity", text: bodyOf(ANSWER_LIMIT_BYTES) },
      log: { thingOutcome: "answered", answerBytes: 1 },
    }));

    const response = await ask("/v1/things/abc");

    expect(ANSWER_LIMIT_BYTES).toBe(5.5 * 1024 * 1024);
    expect(response.statusCode).toBe(500);
    expect((response.body as string).length).toBeLessThan(500);
    expect(JSON.parse(response.body as string)).toMatchObject({
      status: 500,
      code: "serverError",
    });
    expect(entries[0]).toEqual({
      time: new Date(1_000).toISOString(),
      level: "error",
      requestId: "generated-id",
      operation: "getThing",
      outcome: 500,
      code: "serverError",
      durationMs: 0,
      version: "a1b2c3d",
      environment: "test",
      coldStart: false,
      thingId: "abc",
      // The operation's own word for a failed request, not "answered".
      thingOutcome: "failed",
      fault: "answerTooLarge",
      answerBytes: expect.any(Number),
    });
    expect(entries[0]?.answerBytes).toBeGreaterThan(ANSWER_LIMIT_BYTES);
    expect(measurements).toEqual([
      { outcome: 500, durationMs: 0, coldStart: false },
    ]);
  });

  it("measures the response as the platform does: a body just under the limit is refused once its quotation marks are counted", async () => {
    // 5.4 megabytes of quotation marks are 10.8 once each is written as two.
    const quotes = '"'.repeat(Math.floor(ANSWER_LIMIT_BYTES * 0.98));
    const { ask } = setUp(() => ({
      status: 200,
      prepared: { encoding: "identity", text: quotes },
    }));

    expect((await ask("/v1/things/abc")).statusCode).toBe(500);
  });

  it("hands over a response just under the limit", async () => {
    const { ask, entries } = setUp(() => ({
      status: 200,
      prepared: {
        encoding: "identity",
        text: bodyOf(ANSWER_LIMIT_BYTES - 1_000),
      },
    }));

    const response = await ask("/v1/things/abc");

    expect(response.statusCode).toBe(200);
    expect(Buffer.byteLength(JSON.stringify(response))).toBeLessThanOrEqual(
      ANSWER_LIMIT_BYTES,
    );
    expect(entries[0]).not.toHaveProperty("fault");
  });

  it("measures a compressed body in its encoded form, a third larger than the compressed bytes", async () => {
    // Under the limit as bytes, over it once encoded.
    const bytes = new Uint8Array(Math.floor(ANSWER_LIMIT_BYTES * 0.8));
    const { ask, entries } = setUp(() => ({
      status: 200,
      prepared: { encoding: "gzip", bytes },
    }));

    expect((await ask("/v1/things/abc")).statusCode).toBe(500);
    expect(entries[0]?.fault).toBe("answerTooLarge");
  });
});

describe("what an operation adds to its entry (change 5)", () => {
  it("keeps declared fields from log() and from the answer, and drops what was not declared", async () => {
    const { ask, entries } = setUp(() => ({
      status: 200,
      body: { ok: true },
      log: { thingOutcome: "answered", answerBytes: 11, alsoNotDeclared: 1 },
    }));

    await ask("/v1/things/abc");

    expect(entries[0]).toEqual({
      time: new Date(1_000).toISOString(),
      level: "info",
      requestId: "generated-id",
      operation: "getThing",
      outcome: 200,
      durationMs: 0,
      version: "a1b2c3d",
      environment: "test",
      coldStart: false,
      thingId: "abc",
      thingOutcome: "answered",
      answerBytes: 11,
    });
  });

  it("adds the operation's failure fields and the named fault when the operation throws", async () => {
    const { ask, entries } = setUp(() =>
      Promise.reject(
        new OperationFailure("serverError", "the walk did not reach the top", {
          fault: "pathTooDeep",
        }),
      ),
    );

    const response = await ask("/v1/things/abc");

    expect(response.statusCode).toBe(500);
    expect(entries[0]).toMatchObject({
      level: "error",
      outcome: 500,
      code: "serverError",
      fault: "pathTooDeep",
      thingId: "abc",
      thingOutcome: "failed",
      error: { message: "the walk did not reach the top" },
    });
  });

  it("adds the failure fields, and no fault, for a failure that is not a named one", async () => {
    const { ask, entries } = setUp(() =>
      Promise.reject(new Error("connection lost")),
    );

    await ask("/v1/things/abc");

    expect(entries[0]).toMatchObject({ outcome: 500, thingOutcome: "failed" });
    expect(entries[0]).not.toHaveProperty("fault");
  });
});
