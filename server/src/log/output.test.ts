import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEntry } from "./entry.ts";
import {
  createMeasurements,
  MEASUREMENT_NAMES,
  MEASUREMENT_NAMESPACE,
} from "./measurements.ts";
import { createRequestLog } from "./request-log.ts";

// What the libraries really write, read back from the console. In development
// mode Powertools writes through the global console, which a test can watch.
function parsed(call: unknown[] | undefined): Record<string, unknown> {
  return JSON.parse(String(call?.[0])) as Record<string, unknown>;
}

describe("what is written to the log stream", () => {
  beforeEach(() => {
    vi.stubEnv("POWERTOOLS_DEV", "true");
    vi.stubEnv("POWERTOOLS_METRICS_DISABLED", "false");
  });

  it("writes an entry as one JSON line holding exactly the entry's fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const entry = buildEntry({
      time: new Date("2026-12-01T14:03:22.118Z"),
      requestId: "7f3c",
      operation: "getSiteInformation",
      outcome: 200,
      durationMs: 41,
      version: "a1b2c3d",
      environment: "test",
      coldStart: true,
    });

    createRequestLog().write(entry);

    expect(info).toHaveBeenCalledTimes(1);
    expect(parsed(info.mock.calls[0])).toEqual(entry);
  });

  it("writes a server failure at error level, with any email-shaped text removed even if the entry was built elsewhere", () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    createRequestLog().write({
      time: "2026-12-01T14:03:22.118Z",
      level: "error",
      requestId: "7f3c",
      operation: "getSiteInformation",
      outcome: 500,
      code: "serverError",
      durationMs: 3001,
      version: "a1b2c3d",
      environment: "test",
      coldStart: false,
      error: { name: "Error", message: "no row for someone@example.com" },
    });

    expect(info).not.toHaveBeenCalled();
    const written = parsed(error.mock.calls[0]);
    expect(written).toMatchObject({ level: "error", outcome: 500 });
    expect(JSON.stringify(written)).not.toContain("someone@example.com");
    expect(JSON.stringify(written)).toContain("[email removed]");
  });

  it("writes the four measurements in the VirtuosoDrive namespace with the single dimension environment", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    createMeasurements("test").record({
      outcome: 200,
      durationMs: 41,
      coldStart: true,
    });

    expect(log).toHaveBeenCalledTimes(1);
    const written = parsed(log.mock.calls[0]);
    const directive = (
      written._aws as {
        CloudWatchMetrics: {
          Namespace: string;
          Dimensions: string[][];
          Metrics: { Name: string; Unit: string }[];
        }[];
      }
    ).CloudWatchMetrics[0];
    expect(directive?.Namespace).toBe(MEASUREMENT_NAMESPACE);
    expect(directive?.Dimensions).toEqual([["environment"]]);
    expect(directive?.Metrics.map((metric) => metric.Name).sort()).toEqual(
      [...MEASUREMENT_NAMES].sort(),
    );
    expect(written).toMatchObject({
      environment: "test",
      Requests: 1,
      ServerFailures: 0,
      Duration: 41,
      ColdStarts: 1,
    });
    expect(written.service).toBeUndefined();
  });

  it("counts a server failure, and writes zero where nothing happened", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const measurements = createMeasurements("production");

    measurements.record({ outcome: 503, durationMs: 3000, coldStart: false });
    measurements.record({ outcome: 404, durationMs: 2, coldStart: false });

    expect(log).toHaveBeenCalledTimes(2);
    expect(parsed(log.mock.calls[0])).toMatchObject({
      environment: "production",
      Requests: 1,
      ServerFailures: 1,
      ColdStarts: 0,
    });
    expect(parsed(log.mock.calls[1])).toMatchObject({
      Requests: 1,
      ServerFailures: 0,
    });
  });
});
