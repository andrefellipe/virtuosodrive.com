/**
 * What one run of the change runner does (pipeline design, "How the
 * instruction is passed"). The pipeline passes the instruction as the call's
 * input: an object naming the mode.
 *
 * A missing input, an empty one, and one that names no mode this runner
 * knows all mean "apply database changes", which is all the runner did
 * before it had a second mode. So an older pipeline calling a newer runner,
 * or a newer pipeline calling an older runner, applies database changes and
 * nothing else. Only an input naming the load-samples mode loads samples.
 */

export type RunnerMode = "applyChanges" | "loadSamples";

/** The value of `mode` that asks for sample content to be loaded. */
export const LOAD_SAMPLES_MODE = "load-samples";

export function decideMode(input: unknown): RunnerMode {
  if (typeof input !== "object" || input === null) {
    return "applyChanges";
  }
  return (input as { mode?: unknown }).mode === LOAD_SAMPLES_MODE
    ? "loadSamples"
    : "applyChanges";
}
