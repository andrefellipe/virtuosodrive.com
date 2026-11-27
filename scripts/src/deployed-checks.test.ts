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
  /**
   * A stand-in server and clock. Time passes only while a call is answered
   * (by that call's duration) and while the measurement pauses (by the pause
   * asked for), so no test waits for real.
   */
  function timed(durations: number[], failEvery = 0, failStatus = 500) {
    let clock = 0;
    let call = 0;
    const starts: number[] = [];
    const pauses: number[] = [];
    const fetchTimed = (() => {
      starts.push(clock);
      const duration = durations[call % durations.length] as number;
      call += 1;
      clock += duration;
      const failed = failEvery > 0 && call % failEvery === 0;
      return Promise.resolve(
        new Response("{}", { status: failed ? failStatus : 200 }),
      );
    }) as typeof fetch;
    return {
      baseUrl: BASE_URL,
      accessPassword: PASSWORD,
      fetch: fetchTimed,
      now: () => clock,
      wait: (ms: number) => {
        pauses.push(ms);
        clock += ms;
        return Promise.resolve();
      },
      made: () => call,
      starts,
      pauses,
    };
  }

  function gaps(starts: number[]): number[] {
    return starts
      .slice(1)
      .map((start, index) => start - (starts[index] as number));
  }

  it("makes 100 calls after the warm-up and passes when the 95th of 100 is within 1 second", async () => {
    const server = timed([40]);

    const result = await measure(server);

    expect(server.made()).toBe(105);
    expect(result).toEqual({
      calls: 100,
      failures: 0,
      refused: 0,
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

  it("never starts a call sooner than 125 ms after the one before it started, warm-up calls included", async () => {
    // 29 ms a call: what the test environment answered in on 2026-11-27.
    // Unpaced, that is about 34 calls a second against a limit of 10.
    const server = timed([29]);

    await measure(server);

    expect(server.starts).toHaveLength(105);
    expect(gaps(server.starts)).toEqual(Array.from({ length: 104 }, () => 125));
    // Nothing to wait for before the very first call.
    expect(server.starts[0]).toBe(0);
    expect(server.pauses).toHaveLength(104);
  });

  it("keeps to the pace when calls take different times, and to another pace when given one", async () => {
    const uneven = timed([10, 124, 60]);
    await measure({ ...uneven, calls: 30, warmUpCalls: 3 });
    expect(Math.min(...gaps(uneven.starts))).toBe(125);
    expect(Math.max(...gaps(uneven.starts))).toBe(125);

    const slower = timed([10]);
    await measure({ ...slower, calls: 10, warmUpCalls: 0, paceMs: 500 });
    expect(gaps(slower.starts)).toEqual(Array.from({ length: 9 }, () => 500));
  });

  it("adds no pause after a call that already took as long as the pace, or longer", async () => {
    const slow = timed([200]);
    await measure({ ...slow, calls: 10, warmUpCalls: 2 });
    expect(slow.pauses).toEqual([]);
    expect(gaps(slow.starts)).toEqual(Array.from({ length: 11 }, () => 200));

    const exactly = timed([125]);
    await measure({ ...exactly, calls: 10, warmUpCalls: 0 });
    expect(exactly.pauses).toEqual([]);

    // Only the short calls are followed by a pause, and only for what is left of the pace.
    const mixed = timed([200, 25]);
    await measure({ ...mixed, calls: 4, warmUpCalls: 0 });
    expect(mixed.pauses).toEqual([100]);
    expect(gaps(mixed.starts)).toEqual([200, 125, 200]);
  });

  it("pauses again when a pause ends early, so that the gap is never shorter than the pace", async () => {
    const server = timed([25]);
    let clock = 0;
    const starts: number[] = [];
    const early = {
      ...server,
      fetch: (() => {
        starts.push(clock);
        clock += 25;
        return Promise.resolve(new Response("{}", { status: 200 }));
      }) as typeof fetch,
      now: () => clock,
      // A timer that ends 1 ms before it was asked to, as real ones sometimes do.
      wait: (ms: number) => {
        clock += Math.max(ms - 1, 0.5);
        return Promise.resolve();
      },
    };

    await measure({ ...early, calls: 5, warmUpCalls: 0 });

    expect(Math.min(...gaps(starts))).toBeGreaterThanOrEqual(125);
  });

  it("takes each call's time from its own start, so the pause is no part of it", async () => {
    const server = timed([29]);

    const result = await measure(server);

    // Each call was followed by a pause of 96 ms, and none of it is counted.
    expect(server.pauses).toEqual(Array.from({ length: 104 }, () => 96));
    expect(result.p50Ms).toBe(29);
    expect(result.p95Ms).toBe(29);
    expect(result.maxMs).toBe(29);
    expect(result.passed).toBe(true);
  });

  it("still counts a call refused with 429 as a failure, and says how many were refused", async () => {
    // 9 of 100 refused, as on 2026-11-27: more than 5, so the run fails.
    const nineRefused = await measure({
      ...timed([29], 11, 429),
      warmUpCalls: 0,
    });
    expect(nineRefused.failures).toBe(9);
    expect(nineRefused.refused).toBe(9);
    expect(nineRefused.p95Ms).toBe(Number.POSITIVE_INFINITY);
    expect(nineRefused.passed).toBe(false);

    // A refused call is not forgiven even when few enough to pass: it is counted.
    const oneRefused = await measure({
      ...timed([29], 100, 429),
      warmUpCalls: 0,
    });
    expect(oneRefused.failures).toBe(1);
    expect(oneRefused.refused).toBe(1);
    expect(oneRefused.passed).toBe(true);

    // Other failures are failures too, and are not called refused.
    const serverErrors = await measure({
      ...timed([29], 10, 500),
      warmUpCalls: 0,
    });
    expect(serverErrors.failures).toBe(10);
    expect(serverErrors.refused).toBe(0);

    const allRefused = await measure({
      ...timed([29], 1, 429),
      warmUpCalls: 0,
    });
    expect(allRefused.failures).toBe(100);
    expect(allRefused.refused).toBe(100);
    expect(allRefused.passed).toBe(false);
  });

  it("counts a call that could not be made as a failure, and keeps the pace after it", async () => {
    const server = timed([29]);
    let made = 0;
    const unreachable = {
      ...server,
      fetch: ((input: URL, init?: RequestInit) => {
        made += 1;
        return made % 2 === 0
          ? Promise.reject(new TypeError("fetch failed"))
          : server.fetch(input, init);
      }) as typeof fetch,
    };

    const result = await measure({ ...unreachable, calls: 10, warmUpCalls: 0 });

    expect(result.failures).toBe(5);
    expect(result.refused).toBe(0);
    expect(made).toBe(10);
    // A call that failed at once took no time, so the whole pace is waited
    // after it; an answered one took 29 ms, so 96 ms are.
    expect(server.pauses).toEqual([96, 125, 96, 125, 96, 125, 96, 125, 96]);
  });
});
