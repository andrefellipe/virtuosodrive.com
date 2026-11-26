import { describe, expect, it } from "vitest";
import { percentile } from "./percentile.ts";

describe("percentile", () => {
  it("returns the 95th of 100 samples", () => {
    const samples = Array.from({ length: 100 }, (_, index) => index + 1);
    expect(percentile(samples, 95)).toBe(95);
  });

  it("does not depend on the order of the samples", () => {
    expect(percentile([30, 10, 20], 50)).toBe(20);
    expect(percentile([30, 10, 20], 100)).toBe(30);
  });

  it("refuses an empty list", () => {
    expect(() => percentile([], 95)).toThrow(/no samples/);
  });

  it("refuses a share outside 0 to 100", () => {
    expect(() => percentile([1], 0)).toThrow(/share/);
    expect(() => percentile([1], 101)).toThrow(/share/);
  });
});
