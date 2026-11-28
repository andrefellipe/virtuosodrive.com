// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFromServer } from "./call-server.ts";
import type { CallEnvironment } from "./call-server.ts";
import { parseFolder, readFolder } from "./folder.ts";

const FOLDER = "3f2b8c1e-9a4d-4e6f-8b7a-0c1d2e3f4a5b";
const VERSION = `"${FOLDER}.7"`;
const VIEW = {
  folderId: FOLDER,
  name: "Provas",
  path: [
    { folderId: "top", name: "All" },
    { folderId: FOLDER, name: "Provas" },
  ],
  items: [
    { itemId: "a", kind: "folder", name: "2019.1" },
    {
      itemId: "b",
      kind: "file",
      name: "P1.pdf",
      size: 1024,
      contentType: "application/pdf",
    },
  ],
};

type Reply = Response | Error;

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
  const sentHeaders = (call = 0): Record<string, string> =>
    calls[call]?.init.headers as Record<string, string>;
  return { environment, calls, pauses, sentHeaders, reloads: () => reloads };
}

const ok = (headers: HeadersInit = {}) =>
  new Response(JSON.stringify(VIEW), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
const unchanged = () =>
  new Response(null, {
    status: 304,
    headers: { etag: VERSION, "x-request-id": "server-304" },
  });

/** The call function's three outcomes (logical components, change 7). */
describe("reading with a version held", () => {
  it("sends the version the caller holds, and still tells the browser not to store the answer", async () => {
    const { environment, calls, sentHeaders } = setUp([unchanged()]);

    await readFolder(FOLDER, VERSION, environment);

    expect(calls[0]?.url).toBe(`/v1/folders/${FOLDER}`);
    expect(sentHeaders()).toEqual({
      Accept: "application/json",
      "X-Request-Id": "page-1",
      "If-None-Match": VERSION,
    });
    expect(calls[0]?.init).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("sends no version header when the caller holds none", async () => {
    const { environment, sentHeaders } = setUp([ok()]);

    await readFolder("root", undefined, environment);

    expect(sentHeaders()).toEqual({
      Accept: "application/json",
      "X-Request-Id": "page-1",
    });
  });

  it('reports "unchanged" as an outcome of its own: not a failure, and never tried again', async () => {
    const { environment, calls, pauses } = setUp([unchanged()]);

    const result = await readFolder(FOLDER, VERSION, environment);

    expect(result).toEqual({ kind: "unchanged", requestId: "server-304" });
    expect(calls).toHaveLength(1);
    expect(pauses).toEqual([]);
  });

  it("returns the version that came with a success, beside the content", async () => {
    const { environment } = setUp([
      ok({ etag: VERSION, "x-request-id": "server-200" }),
    ]);

    const result = await readFolder(FOLDER, '"old.1"', environment);

    expect(result).toEqual({
      kind: "answered",
      data: VIEW,
      requestId: "server-200",
      version: VERSION,
    });
  });

  it("returns a success without a version when the server sent none", async () => {
    const { environment } = setUp([ok()]);

    const result = await readFolder(FOLDER, undefined, environment);

    expect(result).toEqual({
      kind: "answered",
      data: VIEW,
      requestId: "page-1",
    });
    expect(result).not.toHaveProperty("version");
  });

  it("treats a 304 as a failure when the caller sent no version: there is nothing to keep", async () => {
    const { environment, calls } = setUp([unchanged()]);

    const result = await readFromServer(
      "/v1/folders/root",
      parseFolder,
      environment,
    );

    expect(result).toEqual({ kind: "failed", requestId: "server-304" });
    expect(calls).toHaveLength(1);
  });

  it("still tries again after no answer or a 503, sending the version each time, and can then be told unchanged", async () => {
    const { environment, calls, pauses, sentHeaders } = setUp([
      new TypeError("Failed to fetch"),
      new Response("Service Unavailable", { status: 503 }),
      unchanged(),
    ]);

    const result = await readFolder(FOLDER, VERSION, environment);

    expect(result.kind).toBe("unchanged");
    expect(calls).toHaveLength(3);
    expect(pauses).toEqual([1_000, 3_000]);
    expect([0, 1, 2].map((call) => sentHeaders(call)["If-None-Match"])).toEqual(
      [VERSION, VERSION, VERSION],
    );
  });

  it("reports not found with its code, without another try", async () => {
    const { environment, calls } = setUp([
      new Response(
        JSON.stringify({
          type: "urn:x",
          title: "x",
          status: 404,
          code: "notFound",
        }),
        {
          status: 404,
          headers: { "content-type": "application/problem+json" },
        },
      ),
    ]);

    const result = await readFolder(
      "not-an-identifier",
      undefined,
      environment,
    );

    expect(result).toEqual({
      kind: "failed",
      requestId: "page-1",
      problemCode: "notFound",
    });
    expect(calls).toHaveLength(1);
  });

  it("writes whatever the address named into the request's path safely", async () => {
    const { environment, calls } = setUp([ok()]);

    await readFolder("../v1/health?x=1", undefined, environment);

    expect(calls[0]?.url).toBe("/v1/folders/..%2Fv1%2Fhealth%3Fx%3D1");
  });
});

describe("parseFolder", () => {
  it("accepts the answer and ignores fields it does not know, in the folder and in a row", () => {
    const parsed = parseFolder({
      ...VIEW,
      somethingNew: true,
      items: [
        { ...VIEW.items[1], changedBy: { state: "known", displayName: "x" } },
      ],
    });

    expect(parsed).toEqual({ ...VIEW, items: [VIEW.items[1]] });
  });

  it("keeps a name exactly as sent, whatever it holds", () => {
    const name = '<b>x</b> & "quotes"';

    expect(
      parseFolder({
        ...VIEW,
        name,
        items: [{ itemId: "a", kind: "file", name }],
      }),
    ).toMatchObject({ name, items: [{ name }] });
  });

  it("leaves out a size or a content type of the wrong kind, and keeps the row", () => {
    expect(
      parseFolder({
        ...VIEW,
        items: [
          { itemId: "a", kind: "file", name: "x", size: "big", contentType: 7 },
          { itemId: "b", kind: "file", name: "y", size: -1 },
        ],
      })?.items,
    ).toEqual([
      { itemId: "a", kind: "file", name: "x" },
      { itemId: "b", kind: "file", name: "y" },
    ]);
  });

  it("refuses an answer with a field missing or of the wrong kind", () => {
    for (const broken of [
      { ...VIEW, folderId: undefined },
      { ...VIEW, folderId: "" },
      { ...VIEW, name: 5 },
      { ...VIEW, path: [] },
      { ...VIEW, path: "All" },
      { ...VIEW, path: [{ folderId: "top" }] },
      { ...VIEW, path: [null] },
      { ...VIEW, items: undefined },
      { ...VIEW, items: [{ itemId: "a", kind: "link", name: "x" }] },
      { ...VIEW, items: [{ itemId: "", kind: "file", name: "x" }] },
      { ...VIEW, items: [{ itemId: "a", kind: "file" }] },
      { ...VIEW, items: ["a"] },
    ]) {
      expect(parseFolder(broken)).toBeUndefined();
    }
  });

  it("refuses something that is not an object", () => {
    expect(parseFolder(null)).toBeUndefined();
    expect(parseFolder("folder")).toBeUndefined();
    expect(parseFolder(undefined)).toBeUndefined();
  });
});
