import { describe, expect, it } from "vitest";
import { runCommand } from "./cli.ts";
import type { CliTools } from "./cli.ts";
import {
  FIRST_RELEASE_TITLES,
  grepPattern,
  LATER_SERVER_TAG,
} from "./earlier-release-tests.ts";
import {
  gateCompressed,
  gateFolderSpeed,
  gateNotStored,
  gateUnchanged,
  serverDurationMs,
  SPEED_CALLS,
  SPEED_PACE_MS,
  SPEED_TARGET_MS,
  SPEED_WARM_UP_CALLS,
} from "./gates.ts";
import type { GateOptions } from "./gates.ts";
import { runSmokeCheck } from "./smoke-check.ts";

const BASE_URL = "https://test.virtuoso.example.com";
// Made up for the tests; not a password of any environment.
const PASSWORD = "Example0Password0For0Tests0Only0";
const TOP = "00000000-0000-4000-8000-00000000000a";
const SMALL = "00000000-0000-4000-8000-00000000000b";
const LARGE = "00000000-0000-4000-8000-00000000000c";

/** How a stand-in environment behaves; each test changes what it is about. */
interface Site {
  /** Whether the Release running has the folder route at all. */
  hasFolderRoute: boolean;
  /** Whether the edge passes the caller's version to the server. */
  passesVersionIn: boolean;
  /** Whether the version header comes out through the edge. */
  passesVersionOut: boolean;
  /** Whether the answer travels compressed. */
  compresses: boolean;
  /** The items the 500-item folder answers with. */
  largeCount: number;
  /** The server's own duration for each request, in order; the last repeats. */
  durations: number[];
  /** What the edge says of each answer. */
  xCache: string | null;
  cacheControl: string;
  age: string | null;
  /** The status of the request at this place (from 1), when not the usual one. */
  statusAt: Record<number, number>;
  sampleLoaded: boolean;
}

const SOUND: Site = {
  hasFolderRoute: true,
  passesVersionIn: true,
  passesVersionOut: true,
  compresses: true,
  largeCount: 500,
  durations: [40],
  xCache: "Miss from cloudfront",
  cacheControl: "no-store",
  age: null,
  statusAt: {},
  sampleLoaded: true,
};

/** A stand-in for a deployed environment: the edge, the server and the page. */
function site(changes: Partial<Site> = {}) {
  const state = { ...SOUND, ...changes };
  const asked: { path: string; headers: Headers }[] = [];
  let folderRequests = 0;
  const version = (folderId: string) => `"${folderId}.1"`;
  const folder = (folderId: string) => {
    if (folderId === "root" || folderId === TOP) {
      return {
        folderId: TOP,
        name: "All",
        path: [{ folderId: TOP, name: "All" }],
        items: state.sampleLoaded
          ? [
              { itemId: SMALL, kind: "folder", name: "Twenty items" },
              { itemId: LARGE, kind: "folder", name: "Five hundred items" },
              { itemId: "f", kind: "file", name: "Twenty items", size: 1 },
            ]
          : [],
      };
    }
    const count = folderId === LARGE ? state.largeCount : 20;
    return {
      folderId,
      name: folderId === LARGE ? "Five hundred items" : "Twenty items",
      path: [
        { folderId: TOP, name: "All" },
        { folderId, name: "x" },
      ],
      items: Array.from({ length: count }, (_unused, index) => ({
        itemId: `item-${index}`,
        kind: "file",
        name: `Lecture notes ${String(index + 1).padStart(3, "0")}.pdf`,
        size: 1,
      })),
    };
  };

  const fetchSite = ((input: URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    asked.push({ path: input.pathname, headers });
    const respond = (
      status: number,
      body: unknown,
      more: Record<string, string> = {},
    ) =>
      Promise.resolve(
        new Response(body === null ? null : JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json", ...more },
        }),
      );
    if (input.pathname === "/v1/health") {
      return respond(200, { status: "ok" });
    }
    if (headers.get("cookie") !== `vd_access=${PASSWORD}`) {
      return Promise.resolve(new Response("password page", { status: 401 }));
    }
    if (input.pathname === "/v1/site-information") {
      return respond(200, {
        installedAt: "2026-12-01T14:03:22.118Z",
        version: "a1b2c3d",
        environment: "test",
      });
    }
    const folderId = /^\/v1\/folders\/([^/]+)$/.exec(input.pathname)?.[1];
    if (folderId !== undefined) {
      if (!state.hasFolderRoute) {
        return respond(404, { status: 404, code: "notFound" });
      }
      // Only the sample folders count as "requests for a folder" here.
      if (folderId !== "root") {
        folderRequests += 1;
      }
      const status = state.statusAt[folderRequests];
      if (status !== undefined && folderId !== "root") {
        return respond(status, { message: "refused" });
      }
      const edge: Record<string, string> = {
        "cache-control": state.cacheControl,
        ...(state.xCache === null ? {} : { "x-cache": state.xCache }),
        ...(state.age === null ? {} : { age: state.age }),
        ...(state.passesVersionOut ? { etag: version(folderId) } : {}),
      };
      if (
        state.passesVersionIn &&
        headers.get("if-none-match") === version(folderId)
      ) {
        return respond(304, null, edge);
      }
      const duration =
        state.durations[Math.min(folderRequests, state.durations.length) - 1];
      return respond(200, folder(folderId), {
        ...edge,
        "server-timing": `app;dur=${(duration ?? 0).toFixed(1)}`,
        ...(state.compresses && headers.get("accept-encoding") === "gzip"
          ? { "content-encoding": "gzip" }
          : {}),
      });
    }
    return Promise.resolve(
      new Response(
        '<title>Virtuoso Drive</title><script src="/r/a1b2c3d/assets/index.js"></script>',
        { status: 200 },
      ),
    );
  }) as typeof fetch;

  let clock = 0;
  const pauses: number[] = [];
  const options: GateOptions = {
    baseUrl: BASE_URL,
    accessPassword: PASSWORD,
    fetch: fetchSite,
    now: () => clock,
    wait: (ms) => {
      pauses.push(ms);
      clock += ms;
      return Promise.resolve();
    },
  };
  return {
    options,
    asked,
    pauses,
    folderRequests: () => folderRequests,
    fetchSite,
  };
}

describe("the smoke check and the folder route", () => {
  const smoke = (fetchSite: typeof fetch, hasBrowsing?: boolean) =>
    runSmokeCheck({
      baseUrl: BASE_URL,
      accessPassword: PASSWORD,
      expectedEnvironment: "test",
      expectedVersion: "a1b2c3d",
      ...(hasBrowsing === undefined ? {} : { hasBrowsing }),
      fetch: fetchSite,
      wait: () => Promise.resolve(),
      attempts: 2,
    });

  it("does not ask for a folder unless told the Release has browsing, so a Release without the route passes", async () => {
    const { fetchSite, asked } = site({ hasFolderRoute: false });

    const result = await smoke(fetchSite);

    expect(result).toEqual({ ok: true, failures: [], attempts: 1 });
    expect(asked.map((request) => request.path)).toEqual([
      "/v1/health",
      "/v1/site-information",
      "/",
    ]);
  });

  it("also asks for the top folder, with the access password, when told the Release has browsing", async () => {
    const { fetchSite, asked } = site();

    const result = await smoke(fetchSite, true);

    expect(result.ok).toBe(true);
    expect(asked.map((request) => request.path)).toEqual([
      "/v1/health",
      "/v1/site-information",
      "/",
      "/v1/folders/root",
    ]);
    expect(asked.at(-1)?.headers.get("cookie")).toBe(`vd_access=${PASSWORD}`);
  });

  it("passes on an empty top folder, as production has until the migration", async () => {
    const { fetchSite } = site({ sampleLoaded: false });

    expect((await smoke(fetchSite, true)).ok).toBe(true);
  });

  it("fails when told the Release has browsing and the folder route is not there", async () => {
    const { fetchSite } = site({ hasFolderRoute: false });

    const result = await smoke(fetchSite, true);

    expect(result).toEqual({
      ok: false,
      failures: ["the top folder answered 404, expected 200"],
      attempts: 2,
    });
  });

  it("fails when the top folder's answer is not of the right shape", async () => {
    const { fetchSite } = site();
    const wrongShape = ((input: URL, init?: RequestInit) =>
      input.pathname === "/v1/folders/root"
        ? Promise.resolve(
            new Response(JSON.stringify({ name: "Everything", path: [] })),
          )
        : fetchSite(input, init)) as typeof fetch;

    const result = await smoke(wrongShape, true);

    expect(result.failures).toEqual([
      "the top folder's answer has no folder identifier",
      'the top folder is not named "All"',
      "the top folder's path is not one step long",
      "the top folder's answer has no list of items",
    ]);
  });
});

describe("the gate: unchanged through the whole path", () => {
  it("passes when the folder answers 304 with no content to the version it sent", async () => {
    const { options, asked } = site();

    const result = await gateUnchanged(options);

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    // Found by name from "All", then asked twice, the second time with the version.
    expect(asked.map((request) => request.path)).toEqual([
      "/v1/folders/root",
      `/v1/folders/${SMALL}`,
      `/v1/folders/${SMALL}`,
    ]);
    expect(asked[2]?.headers.get("if-none-match")).toBe(`"${SMALL}.1"`);
  });

  it("fails when the caller's version does not reach the server", async () => {
    const result = await gateUnchanged(
      site({ passesVersionIn: false }).options,
    );

    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain("answered 200, expected 304");
  });

  it("fails when the version header does not come out", async () => {
    const result = await gateUnchanged(
      site({ passesVersionOut: false }).options,
    );

    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain("carried no version");
  });

  it("fails, saying why, when the sample content is not there", async () => {
    const result = await gateUnchanged(site({ sampleLoaded: false }).options);

    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain(
      '"All" holds no folder named "Twenty items"',
    );
  });
});

describe("the gate: compressed through the whole path", () => {
  it("passes when the 500-item folder arrives compressed and unpacks to its list", async () => {
    const { options, asked } = site();

    const result = await gateCompressed(options);

    expect(result.ok).toBe(true);
    expect(asked.at(-1)?.path).toBe(`/v1/folders/${LARGE}`);
    expect(asked.at(-1)?.headers.get("accept-encoding")).toBe("gzip");
  });

  it("fails when the answer does not arrive compressed", async () => {
    const result = await gateCompressed(site({ compresses: false }).options);

    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain('content encoding "none"');
  });

  it("fails when the answer unpacks to the wrong list", async () => {
    const result = await gateCompressed(site({ largeCount: 499 }).options);

    expect(result.failures).toEqual([
      "the answer unpacked to 499 items, expected 500",
    ]);
  });
});

describe("the gate: folder speed", () => {
  it("makes 100 measured requests after the warm-up, no faster than 5 a second, and passes at 500 milliseconds", async () => {
    const { options, folderRequests, pauses } = site({
      durations: [SPEED_TARGET_MS],
    });

    const result = await gateFolderSpeed(options);

    expect(result.ok).toBe(true);
    expect(SPEED_CALLS).toBe(100);
    expect(SPEED_TARGET_MS).toBe(500);
    expect(folderRequests()).toBe(SPEED_WARM_UP_CALLS + SPEED_CALLS);
    // Every request but the first waited out the pace.
    expect(SPEED_PACE_MS).toBe(200);
    expect(pauses).toHaveLength(SPEED_WARM_UP_CALLS + SPEED_CALLS - 1);
    expect(pauses.every((pause) => pause === SPEED_PACE_MS)).toBe(true);
    expect(result.report[0]).toContain("95th of 100 500.0 ms");
  });

  it("reads the server's own figure, not the time the journey took, and leaves the warm-up out", async () => {
    // The three warm-up requests are slow; the hundred measured are not.
    const { options } = site({ durations: [9_000, 9_000, 9_000, 30] });

    const result = await gateFolderSpeed(options);

    expect(result.ok).toBe(true);
    expect(result.report[0]).toContain("slowest 30.0 ms");
  });

  it("fails when the 95th of the 100 is over 500 milliseconds", async () => {
    // Six slow requests of a hundred: the 95th is one of them.
    const durations = [
      ...Array.from({ length: SPEED_WARM_UP_CALLS + 94 }, () => 100),
      ...Array.from({ length: 6 }, () => 501),
    ];
    const result = await gateFolderSpeed(site({ durations }).options);

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(["the folder request is over its target"]);
    expect(result.report[0]).toContain("95th of 100 501.0 ms");
  });

  it("passes with five slow requests of a hundred: the 95th is still fast", async () => {
    const durations = [
      ...Array.from({ length: SPEED_WARM_UP_CALLS + 95 }, () => 100),
      ...Array.from({ length: 5 }, () => 5_000),
    ];

    expect((await gateFolderSpeed(site({ durations }).options)).ok).toBe(true);
  });

  it("fails as its own fault, not as slowness, when a request is refused by the request limit", async () => {
    const { options, folderRequests } = site({ statusAt: { 10: 429 } });

    const result = await gateFolderSpeed(options);

    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain(
      "request 10 was refused by the environment's request limit (429)",
    );
    expect(result.failures[0]).toContain("not slowness");
    expect(folderRequests()).toBe(10);
  });

  it("fails when a request fails, and when the server reports no duration", async () => {
    const failing = await gateFolderSpeed(
      site({ statusAt: { 2: 500 } }).options,
    );
    expect(failing.failures).toEqual(["request 2 answered 500, expected 200"]);

    const { options, fetchSite } = site();
    const withoutTiming = (async (input: URL, init?: RequestInit) => {
      const response = await fetchSite(input, init);
      const headers = new Headers(response.headers);
      headers.delete("server-timing");
      return new Response(response.body, { status: response.status, headers });
    }) as typeof fetch;
    const silent = await gateFolderSpeed({ ...options, fetch: withoutTiming });
    expect(silent.failures[0]).toContain("carried no duration from the server");
  });

  it("reads the duration of the entry named app from the header", () => {
    expect(serverDurationMs("app;dur=12.5")).toBe(12.5);
    expect(serverDurationMs('cdn-cache;desc="MISS", app;dur=7')).toBe(7);
    expect(serverDurationMs('app;desc="server";dur=3.0')).toBe(3);
    expect(serverDurationMs("db;dur=99")).toBeUndefined();
    expect(serverDurationMs("webapp;dur=99")).toBeUndefined();
    expect(serverDurationMs(null)).toBeUndefined();
  });
});

describe("the gate: not stored", () => {
  it("passes when both answers are marked no-store and fetched from the server by the edge", async () => {
    const { options, folderRequests } = site();

    const result = await gateNotStored(options);

    expect(result.ok).toBe(true);
    expect(folderRequests()).toBe(2);
  });

  it("fails when the answer is not marked no-store", async () => {
    const result = await gateNotStored(
      site({ cacheControl: "public, max-age=60" }).options,
    );

    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain('is not marked "no-store"');
  });

  it("fails when the edge served a kept copy", async () => {
    const result = await gateNotStored(
      site({ xCache: "Hit from cloudfront", age: "12" }).options,
    );

    expect(result.failures).toEqual([
      'the edge did not fetch the first answer from the server (X-Cache: "Hit from cloudfront")',
      "the first answer carries an age: it was kept",
      'the edge did not fetch the second answer from the server (X-Cache: "Hit from cloudfront")',
      "the second answer carries an age: it was kept",
    ]);
  });

  it("fails when the edge does not say where the answer came from: it cannot be proved", async () => {
    const result = await gateNotStored(site({ xCache: null }).options);

    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain("no X-Cache header");
  });
});

describe("the gates on the command line", () => {
  function tools(fetchSite: typeof fetch) {
    const out: string[] = [];
    const err: string[] = [];
    let clock = 0;
    const cliTools: CliTools = {
      fetch: fetchSite,
      wait: (ms) => {
        clock += ms;
        return Promise.resolve();
      },
      now: () => clock,
      out: (line) => out.push(line),
      err: (line) => err.push(line),
    };
    return { cliTools, out, err };
  }
  const settings = {
    VD_BASE_URL: BASE_URL,
    VD_ACCESS_PASSWORD: PASSWORD,
    VD_ENVIRONMENT: "test",
  };

  it("runs the named gate and answers 0 when it passes, printing what it found", async () => {
    const { cliTools, out, err } = tools(site().fetchSite);

    for (const name of ["unchanged", "compressed", "speed", "not-stored"]) {
      expect(await runCommand("gate", settings, cliTools, name)).toBe(0);
    }

    expect(out.filter((line) => line.startsWith("Gate "))).toEqual([
      'Gate "unchanged" passed.',
      'Gate "compressed" passed.',
      'Gate "speed" passed.',
      'Gate "not-stored" passed.',
    ]);
    expect(err).toEqual([]);
    expect(`${out.join()}${err.join()}`).not.toContain(PASSWORD);
  });

  it("answers 1 and says why when the gate fails", async () => {
    const { cliTools, err } = tools(site({ compresses: false }).fetchSite);

    expect(await runCommand("gate", settings, cliTools, "compressed")).toBe(1);
    expect(err[0]).toBe('Gate "compressed" failed:');
    expect(err[1]).toContain("expected gzip");
  });

  it("answers 2 for a gate it does not know, and for production, which has no sample content", async () => {
    const { cliTools, err } = tools(site().fetchSite);

    expect(await runCommand("gate", settings, cliTools, "everything")).toBe(2);
    expect(await runCommand("gate", settings, cliTools)).toBe(2);
    expect(
      await runCommand(
        "gate",
        { ...settings, VD_ENVIRONMENT: "production" },
        cliTools,
        "speed",
      ),
    ).toBe(2);
    expect(err).toEqual([
      "Usage: node scripts/src/cli.ts gate <unchanged|compressed|speed|not-stored>",
      "Usage: node scripts/src/cli.ts gate <unchanged|compressed|speed|not-stored>",
      "The gates of browsing run against the test environment",
    ]);
  });

  it("tells the smoke check that the Release has browsing only when VD_HAS_BROWSING is yes", async () => {
    const without = site({ hasFolderRoute: false });
    const withRoute = site();

    expect(
      await runCommand("smoke", settings, tools(without.fetchSite).cliTools),
    ).toBe(0);
    expect(
      await runCommand(
        "smoke",
        { ...settings, VD_HAS_BROWSING: "yes" },
        tools(withRoute.fetchSite).cliTools,
      ),
    ).toBe(0);
    expect(withRoute.asked.map((request) => request.path)).toContain(
      "/v1/folders/root",
    );
    expect(without.asked.map((request) => request.path)).not.toContain(
      "/v1/folders/root",
    );
  });
});

describe("which of an earlier Release's end-to-end tests are run against a newer server", () => {
  it("runs exactly the tagged tests of a Release that has any", () => {
    const specs = [
      `test("a folder is read with no session", { tag: "${LATER_SERVER_TAG}" }, async () => {});`,
      `test("${FIRST_RELEASE_TITLES[0]}", async () => {});`,
    ];

    expect(LATER_SERVER_TAG).toBe("@later-server");
    expect(grepPattern(specs)).toBe("@later-server");
  });

  it("runs the first Release's three tests of the server and the access gate, by their titles, when nothing is tagged", () => {
    const specs = FIRST_RELEASE_TITLES.map(
      (title) => `test("${title}", async () => {});`,
    );

    const pattern = grepPattern(specs) ?? "";

    expect(FIRST_RELEASE_TITLES).toHaveLength(3);
    for (const title of FIRST_RELEASE_TITLES) {
      expect(new RegExp(pattern).test(title)).toBe(true);
    }
    // A test of what the first Release's page shows is not among them.
    expect(
      new RegExp(pattern).test(
        "the page shows the answered view with the version and the environment",
      ),
    ).toBe(false);
  });

  it("finds nothing to run in a Release that has neither, so that the check can fail instead of proving nothing", () => {
    expect(
      grepPattern(['test("something else", async () => {});']),
    ).toBeUndefined();
    expect(grepPattern([])).toBeUndefined();
  });
});
