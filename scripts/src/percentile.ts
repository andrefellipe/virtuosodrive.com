/**
 * The value at or below which the given share of the samples fall
 * (nearest-rank method). Used for "the 95th of 100" in the measurement.
 */
export function percentile(samples: readonly number[], share: number): number {
  if (samples.length === 0) {
    throw new Error("percentile: no samples were given");
  }
  if (!(share > 0 && share <= 100)) {
    throw new Error(
      `percentile: share must be above 0 and at most 100, got ${share}`,
    );
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((share / 100) * sorted.length);
  return sorted[rank - 1] as number;
}
