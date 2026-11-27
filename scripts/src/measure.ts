import { percentile } from "./percentile.ts";

/**
 * The 100-call measurement (performance design P7, requirement NFR9.1): once
 * warm, 95 of 100 site-information calls must take at most 1 second.
 *
 * The time is taken at the caller, so it includes the journey between the
 * pipeline and the edge as well as the server's own time. That can only make
 * the figure larger than the server's own, so passing here means the target
 * is met.
 *
 * The calls are paced: one starts no sooner than PACE_MS after the one before
 * it started, warm-up calls included. Without that, the rate depends on how
 * fast the server answers, and a fast server pushes the measurement over the
 * environment's own request limit: on 2026-11-27 calls took 29 ms each, about
 * 34 a second against the test environment's 10, and 9 of 100 were answered
 * 429. The pause is taken before a call starts and is no part of its time.
 */

export const TARGET_MS = 1_000;
export const CALLS = 100;
export const WARM_UP_CALLS = 5;
/**
 * 8 calls a second at most. The lowest sustained request limit of either
 * environment is the test environment's 10 a second
 * (infra/environment/test.tfvars); production's is 50. If a limit is ever set
 * lower than 10, this must follow it.
 */
export const PACE_MS = 125;
const REFUSED_BY_THE_REQUEST_LIMIT = 429;

export interface MeasureOptions {
  baseUrl: string;
  accessPassword: string;
  fetch: typeof fetch;
  now: () => number;
  /** Pauses for the given milliseconds; passed in so that tests need not wait. */
  wait: (ms: number) => Promise<void>;
  calls?: number;
  warmUpCalls?: number;
  targetMs?: number;
  paceMs?: number;
}

export interface Measurement {
  calls: number;
  failures: number;
  /** How many of the failures were answered 429, by the request limit. */
  refused: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  targetMs: number;
  passed: boolean;
}

type CallResult =
  { ok: true; durationMs: number } | { ok: false; refused: boolean };

/** One call, timed from its own start to the end of its answer. */
async function timedCall(options: MeasureOptions): Promise<{
  startedAt: number;
  result: CallResult;
}> {
  const startedAt = options.now();
  try {
    const response = await options.fetch(
      new URL("/v1/site-information", options.baseUrl),
      {
        method: "GET",
        headers: { Cookie: `vd_access=${options.accessPassword}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    await response.arrayBuffer();
    const result: CallResult =
      response.status === 200
        ? { ok: true, durationMs: options.now() - startedAt }
        : {
            ok: false,
            refused: response.status === REFUSED_BY_THE_REQUEST_LIMIT,
          };
    return { startedAt, result };
  } catch {
    return { startedAt, result: { ok: false, refused: false } };
  }
}

/**
 * Answers a function that makes one call at a time, each starting no sooner
 * than the pace after the one before it started. A call that itself took
 * longer than the pace is followed at once.
 */
function pacedCalls(options: MeasureOptions): () => Promise<CallResult> {
  const paceMs = options.paceMs ?? PACE_MS;
  let previousStartedAt: number | undefined;
  return async () => {
    if (previousStartedAt !== undefined) {
      // Asked again after each pause: a timer may end a moment early, and the
      // gap between two starts must never be shorter than the pace.
      let remainingMs = paceMs - (options.now() - previousStartedAt);
      while (remainingMs > 0) {
        await options.wait(remainingMs);
        remainingMs = paceMs - (options.now() - previousStartedAt);
      }
    }
    const { startedAt, result } = await timedCall(options);
    previousStartedAt = startedAt;
    return result;
  };
}

export async function measure(options: MeasureOptions): Promise<Measurement> {
  const calls = options.calls ?? CALLS;
  const targetMs = options.targetMs ?? TARGET_MS;
  const call = pacedCalls(options);
  for (let made = 0; made < (options.warmUpCalls ?? WARM_UP_CALLS); made += 1) {
    await call();
  }

  const durations: number[] = [];
  let failures = 0;
  let refused = 0;
  for (let made = 0; made < calls; made += 1) {
    const result = await call();
    if (result.ok) {
      durations.push(result.durationMs);
    } else {
      // A refused call is a failure like any other: paced, it should not
      // happen, and if it does the run must not pass over it.
      failures += 1;
      refused += result.refused ? 1 : 0;
    }
  }

  if (durations.length === 0) {
    return {
      calls,
      failures,
      refused,
      p50Ms: Number.NaN,
      p95Ms: Number.NaN,
      maxMs: Number.NaN,
      targetMs,
      passed: false,
    };
  }
  // A failed call counts as slower than any target: it takes a place among the slowest.
  const withFailures = [
    ...durations,
    ...Array.from({ length: failures }, () => Number.POSITIVE_INFINITY),
  ];
  const p95Ms = percentile(withFailures, 95);
  return {
    calls,
    failures,
    refused,
    p50Ms: percentile(durations, 50),
    p95Ms,
    maxMs: Math.max(...durations),
    targetMs,
    passed: p95Ms <= targetMs,
  };
}
