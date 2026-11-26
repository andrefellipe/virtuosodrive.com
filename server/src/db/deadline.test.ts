import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONNECT_LIMIT_MS,
  DATABASE_DEADLINE_MS,
  DeadlineExceededError,
  startDeadline,
  withTimeout,
} from "./deadline.ts";

describe("startDeadline", () => {
  it("gives 3 seconds in total and at most 2 of them to opening a connection", () => {
    const deadline = startDeadline(undefined, () => 0);
    expect(DATABASE_DEADLINE_MS).toBe(3_000);
    expect(CONNECT_LIMIT_MS).toBe(2_000);
    expect(deadline.remainingMs()).toBe(3_000);
    expect(deadline.connectBudgetMs()).toBe(2_000);
    expect(deadline.expired()).toBe(false);
  });

  it("gives opening a connection only what is left when less than its limit remains", () => {
    let now = 0;
    const deadline = startDeadline(3_000, () => now);
    now = 2_400;
    expect(deadline.remainingMs()).toBe(600);
    expect(deadline.connectBudgetMs()).toBe(600);
  });

  it("never reports less than zero and is expired once the time has passed", () => {
    let now = 0;
    const deadline = startDeadline(3_000, () => now);
    now = 3_000;
    expect(deadline.remainingMs()).toBe(0);
    expect(deadline.expired()).toBe(true);
    now = 9_000;
    expect(deadline.remainingMs()).toBe(0);
    expect(deadline.connectBudgetMs()).toBe(0);
  });

  it("refuses a deadline of zero or less", () => {
    expect(() => startDeadline(0)).toThrow(/above zero/);
    expect(() => startDeadline(-1)).toThrow(/above zero/);
  });
});

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers with the work's value when it finishes in time", async () => {
    const work = new Promise<string>((resolve) => {
      setTimeout(() => resolve("done"), 100);
    });
    const result = withTimeout(work, 3_000, "The read");
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe("done");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails with DeadlineExceededError exactly when the limit passes", async () => {
    const never = new Promise<string>(() => undefined);
    const result = withTimeout(never, 3_000, "The read");
    const outcome = result.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(2_999);
    let settled = false;
    void outcome.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const error = await outcome;
    expect(error).toBeInstanceOf(DeadlineExceededError);
    expect((error as Error).message).toBe(
      "The read did not finish within 3000 ms",
    );
  });

  it("passes on the work's own failure and leaves no timer behind", async () => {
    const failure = new Error("connection refused");
    await expect(
      withTimeout(Promise.reject(failure), 3_000, "The read"),
    ).rejects.toBe(failure);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails at once when no time is left, without waiting for the work", async () => {
    const never = new Promise<string>(() => undefined);
    await expect(withTimeout(never, 0, "The read")).rejects.toBeInstanceOf(
      DeadlineExceededError,
    );
  });
});
