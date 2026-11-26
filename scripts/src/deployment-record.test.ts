import { describe, expect, it } from "vitest";
import {
  parseDeployments,
  previousRelease,
  releasesInReach,
  runningRelease,
} from "./deployment-record.ts";
import type { Outcome } from "./deployment-record.ts";

let minute = 0;

/** One entry of GitHub's listing of deployments, as the pipeline records it. */
function entry(
  release: string,
  outcome: Outcome,
  direction: "forward" | "back" = "forward",
) {
  minute += 1;
  return {
    sha: `${release}${"0".repeat(40 - release.length)}`,
    created_at: `2026-12-01T10:${String(minute).padStart(2, "0")}:00Z`,
    environment: "releases-test",
    payload: { release, lambdaVersion: release.length, direction, outcome },
  };
}

const records = (...entries: object[]) =>
  // GitHub lists the newest first.
  parseDeployments(JSON.stringify([...entries].reverse()));

describe("the record of Deployments", () => {
  it("has no running and no previous Release before anything was put in place", () => {
    const none = records();
    const onlyFailed = records(entry("aaa", "notPutInPlace"));

    expect(runningRelease(none)).toBeUndefined();
    expect(previousRelease(none)).toBeUndefined();
    expect(runningRelease(onlyFailed)).toBeUndefined();
    expect(releasesInReach(onlyFailed)).toEqual([]);
  });

  it("has a running Release but no previous one after the first Deployment", () => {
    const first = records(entry("aaa", "succeeded"));

    expect(runningRelease(first)?.release).toBe("aaa");
    expect(previousRelease(first)).toBeUndefined();
  });

  it("names the latest Release put in place as running and the one before it as previous", () => {
    const two = records(entry("aaa", "succeeded"), entry("bbbb", "succeeded"));

    expect(runningRelease(two)).toMatchObject({
      release: "bbbb",
      lambdaVersion: "4",
      sha: `bbbb${"0".repeat(36)}`,
    });
    expect(previousRelease(two)).toMatchObject({
      release: "aaa",
      lambdaVersion: "3",
    });
    expect(releasesInReach(two).map((record) => record.release)).toEqual([
      "bbbb",
      "aaa",
    ]);
  });

  it("does not count a Deployment that did not put its Release in place", () => {
    const failed = records(
      entry("aaa", "succeeded"),
      entry("bbbb", "succeeded"),
      entry("ccccc", "notPutInPlace"),
    );

    expect(runningRelease(failed)?.release).toBe("bbbb");
    expect(previousRelease(failed)?.release).toBe("aaa");
  });

  it("counts a Release that is in place but failing as the running one", () => {
    const failing = records(
      entry("aaa", "succeeded"),
      entry("bbbb", "inPlaceButFailing"),
    );

    expect(runningRelease(failing)?.release).toBe("bbbb");
    expect(previousRelease(failing)?.release).toBe("aaa");
  });

  it("after going back, makes the Release that was left the previous one, so going back again returns to it", () => {
    const wentBack = records(
      entry("aaa", "succeeded"),
      entry("bbbb", "succeeded"),
      entry("aaa", "succeeded", "back"),
    );

    expect(runningRelease(wentBack)).toMatchObject({
      release: "aaa",
      direction: "back",
    });
    expect(previousRelease(wentBack)?.release).toBe("bbbb");
  });

  it("skips a repeated Deployment of the running Release when looking for the previous one", () => {
    const retried = records(
      entry("aaa", "succeeded"),
      entry("bbbb", "inPlaceButFailing"),
      entry("bbbb", "succeeded"),
    );

    expect(previousRelease(retried)?.release).toBe("aaa");
  });

  it("reads a payload sent as JSON text, and leaves out entries that are not the pipeline's records", () => {
    const listing = JSON.stringify([
      {
        ...entry("aaa", "succeeded"),
        payload: JSON.stringify(entry("aaa", "succeeded").payload),
      },
      { sha: "f".repeat(40), created_at: "2026-12-02T00:00:00Z", payload: {} },
      {
        sha: "e".repeat(40),
        created_at: "2026-12-02T00:01:00Z",
        payload: "not json",
      },
      {
        sha: "d".repeat(40),
        created_at: "2026-12-02T00:02:00Z",
        payload: { release: "zzz", outcome: "unknown" },
      },
    ]);

    expect(parseDeployments(listing).map((record) => record.release)).toEqual([
      "aaa",
    ]);
    expect(() => parseDeployments("{}")).toThrow(/JSON array/);
  });
});
