import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { RequestLogEntry } from "../log/entry.ts";
import type { RequestMeasurement } from "../log/measurements.ts";
import { defineOperation } from "./operation.ts";
import type { Operation } from "./operation.ts";
import { OriginSecretVerifier } from "./origin-secret.ts";
import { OperationFailure } from "./problem.ts";
import { createRequestHandler } from "./request-steps.ts";
import type { RequestStepsDependencies } from "./request-steps.ts";
import { httpEvent } from "./testing/events.ts";

const EDGE_SECRET = "edge-secret-for-tests";
const FROM_EDGE = { "x-origin-verify": EDGE_SECRET };
const INTERNAL_REASON =
  "connect ECONNREFUSED 10.0.1.17:5432 while running SELECT installed_at";

function setUp(overrides: Partial<RequestStepsDependencies> = {}) {
  const entries: RequestLogEntry[] = [];
  const measurements: RequestMeasurement[] = [];
  const ran: string[] = [];
  let clock = 1_000;

  const operations: Operation[] = [
    defineOperation({
      name: "getThing",
      method: "GET",
      path: "/v1/thing",
      query: z.strictObject({}),
      run: async () => {
        ran.push("getThing");
        clock += 41;
        return { status: 200, body: { thing: true } };
      },
    }),
    defineOperation({
      name: "getHealth",
      method: "GET",
      path: "/v1/health",
      query: z.strictObject({}),
      healthCheck: true,
      run: async () => {
        ran.push("getHealth");
        return { status: 200, body: { status: "ok" } };
      },
    }),
    defineOperation({
      name: "getBroken",
      method: "GET",
      path: "/v1/broken",
      query: z.strictObject({}),
      run: async () => {
        throw new Error(INTERNAL_REASON);
      },
    }),
    defineOperation({
      name: "getUnavailable",
      method: "GET",
      path: "/v1/unavailable",
      query: z.strictObject({}),
      healthCheck: true,
      run: async () => {
        throw new OperationFailure("serverError", INTERNAL_REASON, {
          status: 503,
        });
      },
    }),
  ];

  let cold = true;
  const handler = createRequestHandler({
    operations,
    originSecret: new OriginSecretVerifier(() => Promise.resolve(EDGE_SECRET)),
    log: { write: (entry) => entries.push(entry) },
    measurements: { record: (measurement) => measurements.push(measurement) },
    environment: "test",
    version: "a1b2c3d",
    takeColdStart: () => {
      const wasCold = cold;
      cold = false;
      return wasCold;
    },
    now: () => clock,
    generateRequestId: () => "generated-id",
    ...overrides,
  });
  return { handler, entries, measurements, ran };
}

describe("request steps", () => {
  it("refuses a request without the edge secret with 403 and no body, before any operation runs", async () => {
    const { handler, entries, measurements, ran } = setUp();

    const response = await handler(httpEvent({ path: "/v1/thing" }));

    expect(response.statusCode).toBe(403);
    expect(response.body).toBeUndefined();
    expect(response.headers?.["x-request-id"]).toBeUndefined();
    expect(ran).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      operation: "access refused",
      outcome: 403,
    });
    expect(measurements).toEqual([]);
  });

  it("refuses a wrong edge secret, including on the health check", async () => {
    const { handler, ran } = setUp();

    const response = await handler(
      httpEvent({
        path: "/v1/health",
        headers: { "x-origin-verify": "a-guess" },
      }),
    );

    expect(response.statusCode).toBe(403);
    expect(response.body).toBeUndefined();
    expect(ran).toEqual([]);
  });

  it("answers an operation with JSON, the request identifier and the headers every answer carries", async () => {
    const { handler } = setUp();

    const response = await handler(
      httpEvent({
        path: "/v1/thing",
        headers: { ...FROM_EDGE, "x-request-id": "page-7f3c" },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ thing: true });
    expect(response.headers).toEqual({
      "content-type": "application/json",
      "x-request-id": "page-7f3c",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
  });

  it("finds the request identifier whatever the case of the header's name", async () => {
    const { handler, entries } = setUp();

    const response = await handler(
      httpEvent({
        path: "/v1/thing",
        headers: { "X-Origin-Verify": EDGE_SECRET, "X-Request-Id": "abc-123" },
      }),
    );

    expect(response.headers?.["x-request-id"]).toBe("abc-123");
    expect(entries[0]?.requestId).toBe("abc-123");
  });

  it("replaces a malformed request identifier and does not log what was sent", async () => {
    const { handler, entries } = setUp();
    const malformed = "bad id <script>";

    const response = await handler(
      httpEvent({
        path: "/v1/thing",
        headers: { ...FROM_EDGE, "x-request-id": malformed },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers?.["x-request-id"]).toBe("generated-id");
    expect(entries[0]?.requestId).toBe("generated-id");
    expect(JSON.stringify(entries)).not.toContain(malformed);
  });

  it("refuses unknown query parameters with invalidInput and does not run the operation", async () => {
    const { handler, ran, entries } = setUp();

    const response = await handler(
      httpEvent({
        path: "/v1/thing",
        headers: FROM_EDGE,
        query: { debug: "true" },
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.headers?.["content-type"]).toBe("application/problem+json");
    expect(JSON.parse(response.body as string)).toMatchObject({
      status: 400,
      code: "invalidInput",
    });
    expect(ran).toEqual([]);
    expect(entries[0]).toMatchObject({
      operation: "getThing",
      outcome: 400,
      code: "invalidInput",
      level: "info",
    });
    expect(JSON.stringify(entries)).not.toContain("debug");
  });

  it("answers an unknown path with notFound", async () => {
    const { handler, entries } = setUp();

    const response = await handler(
      httpEvent({ path: "/v1/nothing-here", headers: FROM_EDGE }),
    );

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body as string)).toMatchObject({
      status: 404,
      code: "notFound",
    });
    expect(response.headers?.["x-request-id"]).toBe("generated-id");
    expect(entries[0]).toMatchObject({ operation: "unknown", outcome: 404 });
    expect(JSON.stringify(entries)).not.toContain("nothing-here");
  });

  it("answers a known path asked with another method with notFound", async () => {
    const { handler, ran } = setUp();

    const response = await handler(
      httpEvent({ method: "POST", path: "/v1/thing", headers: FROM_EDGE }),
    );

    expect(response.statusCode).toBe(404);
    expect(ran).toEqual([]);
  });

  it("turns a thrown error into serverError with nothing internal in the answer, and logs the reason", async () => {
    const { handler, entries } = setUp();

    const response = await handler(
      httpEvent({ path: "/v1/broken", headers: FROM_EDGE }),
    );

    expect(response.statusCode).toBe(500);
    expect(response.headers?.["content-type"]).toBe("application/problem+json");
    const body = JSON.parse(response.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "code",
      "detail",
      "status",
      "title",
      "type",
    ]);
    expect(body).toMatchObject({ status: 500, code: "serverError" });
    for (const internal of ["ECONNREFUSED", "10.0.1.17", "SELECT", "at "]) {
      expect(response.body).not.toContain(internal);
    }
    expect(entries[0]).toMatchObject({
      level: "error",
      operation: "getBroken",
      outcome: 500,
      code: "serverError",
      error: { name: "Error", message: INTERNAL_REASON },
    });
    expect(entries[0]?.error?.stack).toContain("request-steps.test");
  });

  it("uses the status an operation's own failure names (503 for health)", async () => {
    const { handler } = setUp();

    const response = await handler(
      httpEvent({ path: "/v1/unavailable", headers: FROM_EDGE }),
    );

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body as string)).toMatchObject({
      status: 503,
      code: "serverError",
    });
    expect(response.body).not.toContain("ECONNREFUSED");
  });

  it("writes a log entry with exactly the named fields", async () => {
    const { handler, entries } = setUp();

    await handler(
      httpEvent({
        path: "/v1/thing",
        headers: { ...FROM_EDGE, "x-request-id": "page-7f3c" },
      }),
    );

    expect(entries).toEqual([
      {
        time: new Date(1_000).toISOString(),
        level: "info",
        requestId: "page-7f3c",
        operation: "getThing",
        outcome: 200,
        durationMs: 41,
        version: "a1b2c3d",
        environment: "test",
        coldStart: true,
      },
    ]);
  });

  it("writes the four measurements' inputs for an ordinary request", async () => {
    const { handler, measurements } = setUp();

    await handler(httpEvent({ path: "/v1/thing", headers: FROM_EDGE }));
    await handler(httpEvent({ path: "/v1/broken", headers: FROM_EDGE }));

    expect(measurements).toEqual([
      { outcome: 200, durationMs: 41, coldStart: true },
      { outcome: 500, durationMs: 0, coldStart: false },
    ]);
  });

  it("writes a log entry but no measurements for a health check, healthy or not", async () => {
    const { handler, entries, measurements } = setUp();

    await handler(httpEvent({ path: "/v1/health", headers: FROM_EDGE }));
    await handler(httpEvent({ path: "/v1/unavailable", headers: FROM_EDGE }));

    expect(entries.map((entry) => entry.operation)).toEqual([
      "getHealth",
      "getUnavailable",
    ]);
    expect(entries.map((entry) => entry.outcome)).toEqual([200, 503]);
    expect(measurements).toEqual([]);
  });

  it("marks only a copy's first request as a cold start", async () => {
    const { handler, entries } = setUp();

    await handler(httpEvent({ path: "/v1/thing", headers: FROM_EDGE }));
    await handler(httpEvent({ path: "/v1/thing", headers: FROM_EDGE }));

    expect(entries.map((entry) => entry.coldStart)).toEqual([true, false]);
  });

  it("answers serverError when the edge secret cannot be read at all", async () => {
    const { handler, entries, ran } = setUp({
      originSecret: new OriginSecretVerifier(() =>
        Promise.reject(new Error("secrets endpoint unreachable")),
      ),
    });

    const response = await handler(
      httpEvent({ path: "/v1/thing", headers: FROM_EDGE }),
    );

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("secrets endpoint");
    expect(ran).toEqual([]);
    expect(entries[0]).toMatchObject({
      level: "error",
      outcome: 500,
      error: { message: "secrets endpoint unreachable" },
    });
  });

  it("still answers when the log entry cannot be written, and says so on standard error", async () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const { handler } = setUp({
      log: {
        write: () => {
          throw new Error("log stream closed");
        },
      },
    });

    const response = await handler(
      httpEvent({ path: "/v1/thing", headers: FROM_EDGE }),
    );

    expect(response.statusCode).toBe(200);
    expect(stderr).toHaveBeenCalledWith(
      "The request entry could not be written: Error\n",
    );
  });
});
