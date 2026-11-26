/**
 * One deadline per request for everything asked of the database: opening a
 * connection if one is needed, and the statement, together (performance
 * design P3, reliability design R1).
 */

/** Everything the database is asked for one request must finish within this. */
export const DATABASE_DEADLINE_MS = 3_000;

/** Of that, opening a connection may take at most this. */
export const CONNECT_LIMIT_MS = 2_000;

export class DeadlineExceededError extends Error {
  constructor(what: string, limitMs: number) {
    super(`${what} did not finish within ${limitMs} ms`);
    this.name = "DeadlineExceededError";
  }
}

export interface Deadline {
  /** Milliseconds left; never below zero. */
  remainingMs(): number;
  /** How long opening a connection may take: the connect limit, or what is left if that is less. */
  connectBudgetMs(): number;
  expired(): boolean;
}

export function startDeadline(
  totalMs: number = DATABASE_DEADLINE_MS,
  now: () => number = Date.now,
  connectLimitMs: number = CONNECT_LIMIT_MS,
): Deadline {
  if (!(totalMs > 0)) {
    throw new Error(`A deadline must be above zero, got ${totalMs}`);
  }
  const endsAt = now() + totalMs;
  const remainingMs = (): number => Math.max(0, endsAt - now());
  return {
    remainingMs,
    connectBudgetMs: () => Math.min(connectLimitMs, remainingMs()),
    expired: () => remainingMs() === 0,
  };
}

/**
 * Resolves or rejects with the work, or rejects with DeadlineExceededError
 * once the limit passes, whichever comes first. The work itself is not
 * stopped; the caller discards whatever it was using.
 */
export function withTimeout<T>(
  work: Promise<T>,
  limitMs: number,
  what: string,
): Promise<T> {
  if (limitMs <= 0) {
    // The work may already be running; its outcome no longer matters.
    work.catch(() => undefined);
    return Promise.reject(new DeadlineExceededError(what, 0));
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DeadlineExceededError(what, limitMs));
    }, limitMs);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
