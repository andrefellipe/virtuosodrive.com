// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readFromServer,
  REQUEST_LIMIT_MS,
  RETRY_PAUSES_MS,
} from "./call-server.ts";
import type { CallEnvironment } from "./call-server.ts";
import { parseSiteStatus, readSiteInformation } from "./site-information.ts";

const PATH = "/v1/site-information";
const ANSWER = {
  installedAt: "2026-12-01T14:03:22.118Z",
  version: "a1b2c3d",
  environment: "test",
};

type Reply = Response | Error | "never";

function json(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function problem(status: number, code: string, requestId = "server-id") {
  return new Response(
    JSON.stringify({ type: "urn:x", title: "x", status, code }),
    {
      status,
      headers: {
        "content-type": "application/problem+json",
        "x-request-id": requestId,
      },
    },
  );
}

/** Replaces the browser's fetch, the pause and the reload for one test. */
function setUp(replies: Reply[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const pauses: number[] = [];
  let reloads = 0;
  let nextId = 0;
  const environment: CallEnvironment = {
    fetch: ((url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const reply = replies.shift();
      if (reply === undefined) {
        throw new Error("The test did not expect another call to the server");
      }
      if (reply === "never") {
        // Like the browser's fetch: no answer, until the caller gives up.
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        });
      }
      return reply instanceof Error
        ? Promise.reject(reply)
        : Promise.resolve(reply);
    }) as typeof fetch,
    wait: (ms) => {
      pauses.push(ms);
      return Promise.resolve();
    },
    reload: () => {
      reloads += 1;
    },
    newRequestId: () => `page-${++nextId}`,
  };
  const sentIds = (): (string | undefined)[] =>
    calls.map(
      (call) => (call.init.headers as Record<string, string>)["X-Request-Id"],
    );
  return { environment, calls, pauses, sentIds, reloads: () => reloads };
}

describe("readFromServer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers with the data on the first try, sending a request identifier and never using a stored answer", async () => {
    const { environment, calls, pauses } = setUp([
      json(200, ANSWER, { "x-request-id": "page-1" }),
    ]);

    const result = await readFromServer(PATH, parseSiteStatus, environment);

    expect(result).toEqual({
      kind: "answered",
      data: ANSWER,
      requestId: "page-1",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(PATH);
    expect(calls[0]?.init).toMatchObject({
      method: "GET",
      cache: "no-store",
      headers: { "X-Request-Id": "page-1" },
    });
    expect(pauses).toEqual([]);
  });

  it("tries a read three times in all, pausing 1 second and then 3 seconds, and then reports failure with the last identifier", async () => {
    const { environment, calls, pauses } = setUp([
      new TypeError("Failed to fetch"),
      new TypeError("Failed to fetch"),
      new TypeError("Failed to fetch"),
    ]);

    const result = await readFromServer(PATH, parseSiteStatus, environment);

    expect(calls).toHaveLength(3);
    expect(pauses).toEqual([1_000, 3_000]);
    expect(RETRY_PAUSES_MS).toEqual([1_000, 3_000]);
    expect(result).toEqual({ kind: "failed", requestId: "page-3" });
  });

  it("sends a fresh request identifier with each attempt", async () => {
    const { environment, sentIds } = setUp([
      new TypeError("Failed to fetch"),
      new TypeError("Failed to fetch"),
      json(200, ANSWER),
    ]);

    const result = await readFromServer(PATH, parseSiteStatus, environment);

    expect(sentIds()).toEqual(["page-1", "page-2", "page-3"]);
    expect(result).toMatchObject({ kind: "answered", requestId: "page-3" });
  });

  it("tries again after a 503, whether or not it is a Problem", async () => {
    const { environment, calls, pauses } = setUp([
      problem(503, "serverError"),
      new Response("Service Unavailable", { status: 503 }),
      json(200, ANSWER),
    ]);

    const result = await readFromServer(PATH, parseSiteStatus, environment);

    expect(result.kind).toBe("answered");
    expect(calls).toHaveLength(3);
    expect(pauses).toEqual([1_000, 3_000]);
  });

  it("tries again after a 429 from the entry point, which is not a Problem", async () => {
    const { environment, calls } = setUp([
      json(429, { message: "Too Many Requests" }),
      json(200, ANSWER),
    ]);

    const result = await readFromServer(PATH, parseSiteStatus, environment);

    expect(result.kind).toBe("answered");
    expect(calls).toHaveLength(2);
  });

  it("treats any other Problem as final: no further try, the code and the server's identifier reported", async () => {
    for (const [status, code] of [
      [500, "serverError"],
      [404, "notFound"],
      [400, "invalidInput"],
    ] as const) {
      const { environment, calls, pauses } = setUp([
        problem(status, code, "server-9"),
      ]);

      const result = await readFromServer(PATH, parseSiteStatus, environment);

      expect(result).toEqual({
        kind: "failed",
        requestId: "server-9",
        problemCode: code,
      });
      expect(calls).toHaveLength(1);
      expect(pauses).toEqual([]);
    }
  });

  it("reloads the page, once, on a 401 that is not a Problem, and does not try again", async () => {
    const { environment, calls, reloads } = setUp([
      new Response("<!doctype html><title>access password</title>", {
        status: 401,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    ]);

    const result = await readFromServer(PATH, parseSiteStatus, environment);

    expect(result).toEqual({ kind: "accessNeeded" });
    expect(reloads()).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it("does not reload on a 401 that is a Problem", async () => {
    const { environment, reloads } = setUp([problem(401, "notSignedIn")]);

    const result = await readFromServer(PATH, parseSiteStatus, environment);

    expect(result).toMatchObject({
      kind: "failed",
      problemCode: "notSignedIn",
    });
    expect(reloads()).toBe(0);
  });

  it("gives up on an attempt after 10 seconds and then tries again", async () => {
    vi.useFakeTimers();
    const { environment, calls } = setUp(["never", json(200, ANSWER)]);

    const pending = readFromServer(PATH, parseSiteStatus, environment);
    await vi.advanceTimersByTimeAsync(REQUEST_LIMIT_MS - 1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(REQUEST_LIMIT_MS).toBe(10_000);
    expect(calls[0]?.init.signal?.aborted).toBe(true);
    expect(calls).toHaveLength(2);
    expect(result.kind).toBe("answered");
  });

  it("reports failure, without another try, when a 200 does not hold the expected answer", async () => {
    const { environment, calls } = setUp([
      new Response("<!doctype html><title>Virtuoso Drive</title>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    ]);

    const result = await readFromServer(PATH, parseSiteStatus, environment);

    expect(result).toEqual({ kind: "failed", requestId: "page-1" });
    expect(calls).toHaveLength(1);
  });

  it("in the browser, really waits 1 second and then 3 before trying again", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json(200, ANSWER));
    vi.stubGlobal("fetch", fetchMock);

    const pending = readSiteInformation();
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ kind: "answered", data: ANSWER });
    const ids = fetchMock.mock.calls.map(
      (call) => (call[1]?.headers as Record<string, string>)["X-Request-Id"],
    );
    expect(new Set(ids).size).toBe(3);
  });
});

describe("parseSiteStatus", () => {
  it("accepts the answer and ignores fields it does not know", () => {
    expect(parseSiteStatus({ ...ANSWER, somethingNew: true })).toEqual(ANSWER);
  });

  it("refuses an answer with a field missing or of the wrong kind", () => {
    expect(parseSiteStatus({ ...ANSWER, version: undefined })).toBeUndefined();
    expect(parseSiteStatus({ ...ANSWER, version: "" })).toBeUndefined();
    expect(parseSiteStatus({ ...ANSWER, installedAt: 5 })).toBeUndefined();
    expect(
      parseSiteStatus({ ...ANSWER, environment: "staging" }),
    ).toBeUndefined();
  });

  it("refuses something that is not an object", () => {
    expect(parseSiteStatus(null)).toBeUndefined();
    expect(parseSiteStatus("ok")).toBeUndefined();
    expect(parseSiteStatus(undefined)).toBeUndefined();
  });
});
