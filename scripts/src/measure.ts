import { percentile } from "./percentile.ts";

/**
 * The 100-call measurement (performance design P7, requirement NFR9.1): once
 * warm, 95 of 100 site-information calls must take at most 1 second.
 *
 * The time is taken at the caller, so it includes the journey between the
 * pipeline and the edge as well as the server's own time. That can only make
 * the figure larger than the server's own, so passing here means the target
 * is met.
 */

export const TARGET_MS = 1_000;
export const CALLS = 100;
export const WARM_UP_CALLS = 5;

export interface MeasureOptions {
  baseUrl: string;
  accessPassword: string;
  fetch: typeof fetch;
  now: () => number;
  calls?: number;
  warmUpCalls?: number;
  targetMs?: number;
}

export interface Measurement {
  calls: number;
  failures: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  targetMs: number;
  passed: boolean;
}

async function timedCall(options: MeasureOptions): Promise<number | undefined> {
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
    return response.status === 200 ? options.now() - startedAt : undefined;
  } catch {
    return undefined;
  }
}

export async function measure(options: MeasureOptions): Promise<Measurement> {
  const calls = options.calls ?? CALLS;
  const targetMs = options.targetMs ?? TARGET_MS;
  for (let call = 0; call < (options.warmUpCalls ?? WARM_UP_CALLS); call += 1) {
    await timedCall(options);
  }

  const durations: number[] = [];
  let failures = 0;
  for (let call = 0; call < calls; call += 1) {
    const duration = await timedCall(options);
    if (duration === undefined) {
      failures += 1;
    } else {
      durations.push(duration);
    }
  }

  if (durations.length === 0) {
    return {
      calls,
      failures,
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
    p50Ms: percentile(durations, 50),
    p95Ms,
    maxMs: Math.max(...durations),
    targetMs,
    passed: p95Ms <= targetMs,
  };
}
