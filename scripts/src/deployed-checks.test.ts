import { describe, expect, it } from "vitest";
import { measure } from "./measure.ts";
import { runSmokeCheck } from "./smoke-check.ts";
import type { SmokeCheckOptions } from "./smoke-check.ts";

const BASE_URL = "https://test.virtuoso.example.com";
// Made up for the tests; not a password of any environment.
const PASSWORD = "Example0Password0For0Tests0Only0";

interface Site {
  version: string;
  environment: string;
  healthStatus: number;
  pageVersion: string;
}

/** A stand-in for a deployed environment: the edge's gate, the server and the page. */
function site(state: Site) {
  const asked: { path: string; cookie: string | null }[] = [];
  const fetchSite = ((input: URL, init: RequestInit = {}) => {
    const cookie = new Headers(init.headers).get("cookie");
    asked.push({ path: input.pathname, cookie });
    const json = (status: number, body: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
      );
    if (input.pathname === "/v1/health") {
      return json(state.healthStatus, { status: "ok" });
    }
    if (cookie !== `vd_access=${PASSWORD}`) {
      return Promise.resolve(new Response("password page", { status: 401 }));
    }
    if (input.pathname === "/v1/site-information") {
      return json(200, {
        installedAt: "2026-12-01T14:03:22.118Z",
        version: state.version,
        environment: state.environment,
      });
    }
    return Promise.resolve(
      new Response(
        `<title>Virtuoso Drive</title><script src="/r/${state.pageVersion}/assets/index.js"></script>`,
        { status: 200 },
      ),
    );
  }) as typeof fetch;
  return { fetchSite, asked };
}

function options(
  fetchSite: typeof fetch,
  overrides: Partial<SmokeCheckOptions> = {},
): SmokeCheckOptions & { pauses: number[] } {
  const pauses: number[] = [];
  return {
    baseUrl: BASE_URL,
    accessPassword: PASSWORD,
    expectedEnvironment: "test",
    expectedVersion: "a1b2c3d",
    fetch: fetchSite,
    wait: (ms) => {
      pauses.push(ms);
      return Promise.resolve();
    },
    pauses,
    ...overrides,
  };
}

const healthy: Site = {
  version: "a1b2c3d",
  environment: "test",
  healthStatus: 200,
  pageVersion: "a1b2c3d",
};

describe("runSmokeCheck", () => {
  it("passes when health, site information and the page all answer with the expected version", async () => {
    const { fetchSite, asked } = site(healthy);

    const result = await runSmokeCheck(options(fetchSite));

    expect(result).toEqual({ ok: true, failures: [], attempts: 1 });
    expect(asked).toEqual([
      { path: "/v1/health", cookie: null },
      { path: "/v1/site-information", cookie: `vd_access=${PASSWORD}` },
      { path: "/", cookie: `vd_access=${PASSWORD}` },
    ]);
  });

  it("fails, after trying five times, when the server still runs another version", async () => {
    const { fetchSite } = site({ ...healthy, version: "0ld0ld0" });
    const given = options(fetchSite);

    const result = await runSmokeCheck(given);

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(5);
    expect(given.pauses).toEqual([5_000, 5_000, 5_000, 5_000]);
    expect(result.failures).toEqual([
      'the server runs version "0ld0ld0", expected "a1b2c3d"',
    ]);
  });

  it("fails when health answers 503, when the page points at another Release's files, or in the wrong environment", async () => {
    const down = await runSmokeCheck(
      options(site({ ...healthy, healthStatus: 503 }).fetchSite, {
        attempts: 1,
      }),
    );
    const stalePage = await runSmokeCheck(
      options(site({ ...healthy, pageVersion: "0ld0ld0" }).fetchSite, {
        attempts: 1,
      }),
    );
    const wrongPlace = await runSmokeCheck(
      options(site({ ...healthy, environment: "production" }).fetchSite, {
        attempts: 1,
      }),
    );

    expect(down.failures).toEqual(["health answered 503, expected 200"]);
    expect(stalePage.failures).toEqual([
      'the page does not point at the files of version "a1b2c3d"',
    ]);
    expect(wrongPlace.failures).toEqual([
      'site information is for environment "production", expected "test"',
    ]);
  });

  it("fails with a wrong access password, and never includes the password in what it reports", async () => {
    const result = await runSmokeCheck(
      options(site(healthy).fetchSite, {
        accessPassword: "Wrong0Password0For0Tests",
        attempts: 1,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      "site information answered 401, expected 200",
      "the page answered 401, expected 200",
    ]);
    expect(JSON.stringify(result)).not.toContain("Wrong0Password");
  });

  it("checks whatever is running when no version is expected, and passes once the site recovers", async () => {
    const state = { ...healthy, version: "anything", pageVersion: "other" };
    const { fetchSite } = site(state);
    let calls = 0;
    const flaky = ((input: URL, init?: RequestInit) => {
      calls += 1;
      return calls <= 3
        ? Promise.reject(new TypeError("fetch failed"))
        : fetchSite(input, init);
    }) as typeof fetch;

    const result = await runSmokeCheck(
      options(flaky, { expectedVersion: undefined }),
    );

    expect(result).toEqual({ ok: true, failures: [], attempts: 2 });
  });
});

describe("measure", () => {
  function timed(durations: number[], failEvery = 0) {
    let clock = 0;
    let call = 0;
    const fetchTimed = (() => {
      const duration = durations[call % durations.length] as number;
      call += 1;
      clock += duration;
      const failed = failEvery > 0 && call % failEvery === 0;
      return Promise.resolve(
        new Response("{}", { status: failed ? 500 : 200 }),
      );
    }) as typeof fetch;
    return {
      baseUrl: BASE_URL,
      accessPassword: PASSWORD,
      fetch: fetchTimed,
      now: () => clock,
      made: () => call,
    };
  }

  it("makes 100 calls after the warm-up and passes when the 95th of 100 is within 1 second", async () => {
    const server = timed([40]);

    const result = await measure(server);

    expect(server.made()).toBe(105);
    expect(result).toEqual({
      calls: 100,
      failures: 0,
      p50Ms: 40,
      p95Ms: 40,
      maxMs: 40,
      targetMs: 1_000,
      passed: true,
    });
  });

  it("fails when more than 5 in 100 calls are slower than 1 second", async () => {
    // Every tenth call is slow: 10 slow calls in 100.
    const slowTenth = [...Array.from({ length: 9 }, () => 50), 1_500];

    const result = await measure({ ...timed(slowTenth), warmUpCalls: 0 });

    expect(result.p95Ms).toBe(1_500);
    expect(result.p50Ms).toBe(50);
    expect(result.passed).toBe(false);
  });

  it("counts failed calls among the slowest, and fails outright when every call fails", async () => {
    const someFail = await measure({ ...timed([40], 10), warmUpCalls: 0 });
    expect(someFail.failures).toBe(10);
    expect(someFail.passed).toBe(false);

    const fewFail = await measure({ ...timed([40], 25), warmUpCalls: 0 });
    expect(fewFail.failures).toBe(4);
    expect(fewFail.passed).toBe(true);

    const allFail = await measure({ ...timed([40], 1), warmUpCalls: 0 });
    expect(allFail.failures).toBe(100);
    expect(allFail.passed).toBe(false);
  });
});
