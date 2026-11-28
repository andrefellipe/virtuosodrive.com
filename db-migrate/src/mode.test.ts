import { describe, expect, it } from "vitest";
import { decideMode, LOAD_SAMPLES_MODE } from "./mode.ts";

describe("what one run of the change runner does", () => {
  it.each([
    ["a missing input", undefined],
    ["an empty input", {}],
    ["an input that names no mode", { reason: "deployment" }],
    ["null", null],
    ["an input naming a mode this runner does not know", { mode: "reindex" }],
    ["the mode's name as plain text, not as an object", "load-samples"],
    ["the mode's name in another letter case", { mode: "Load-Samples" }],
    ["a mode that is not text", { mode: true }],
    ["a list", [{ mode: "load-samples" }]],
  ])("applies database changes for %s", (_what, input) => {
    expect(decideMode(input)).toBe("applyChanges");
  });

  it("loads samples only for an input naming the load-samples mode", () => {
    expect(LOAD_SAMPLES_MODE).toBe("load-samples");
    expect(decideMode({ mode: "load-samples" })).toBe("loadSamples");
    expect(decideMode({ mode: "load-samples", extra: 1 })).toBe("loadSamples");
  });
});
