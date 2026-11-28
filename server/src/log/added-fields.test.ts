import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEntry, checkAddedFields } from "./entry.ts";
import type { EntryInput } from "./entry.ts";
import { FAULTS } from "./fault.ts";
import { createMeasurements } from "./measurements.ts";

const base: EntryInput = {
  time: new Date("2026-12-01T14:03:22.118Z"),
  requestId: "7f3c",
  operation: "getFolder",
  outcome: 200,
  durationMs: 12,
  version: "a1b2c3d",
  environment: "test",
  coldStart: false,
};

const DECLARED = {
  folderId: "string",
  rows: "number",
  versionSent: "boolean",
} as const;

describe("fields an operation adds to its log entry (logical components, change 5)", () => {
  it("keeps the declared fields whose values are of the declared type", () => {
    expect(
      checkAddedFields(DECLARED, {
        folderId: "3f2b8c1e",
        rows: 0,
        versionSent: false,
      }),
    ).toEqual({ folderId: "3f2b8c1e", rows: 0, versionSent: false });
  });

  it("drops a field that was not declared, and one whose value is of another type", () => {
    expect(
      checkAddedFields(DECLARED, {
        folderId: 42,
        rows: "many",
        versionSent: "yes",
        name: "Prova final.pdf",
        extra: true,
      }),
    ).toEqual({});
    expect(checkAddedFields(DECLARED, { rows: Number.NaN })).toEqual({});
    expect(checkAddedFields(undefined, { folderId: "x" })).toEqual({});
  });

  it("never lets an operation declare one of the entry's own fields", () => {
    expect(
      checkAddedFields(
        { outcome: "number", requestId: "string", fault: "string" },
        { outcome: 200, requestId: "forged", fault: "storeRefused" },
      ),
    ).toEqual({});
  });

  it("puts the added fields in the entry beside its own, which they cannot replace", () => {
    const entry = buildEntry({
      ...base,
      added: {
        folderId: "3f2b8c1e",
        rows: 20,
        versionSent: true,
        outcome: 500,
        level: "error",
      },
    });

    expect(entry).toEqual({
      time: "2026-12-01T14:03:22.118Z",
      level: "info",
      requestId: "7f3c",
      operation: "getFolder",
      outcome: 200,
      durationMs: 12,
      version: "a1b2c3d",
      environment: "test",
      coldStart: false,
      folderId: "3f2b8c1e",
      rows: 20,
      versionSent: true,
    });
  });

  it("scrubs the added fields like the rest", () => {
    const entry = buildEntry({
      ...base,
      added: { folderId: "sent by someone@example.com" },
    });

    expect(entry.folderId).toBe("sent by [email removed]");
  });

  it("names a fault in a field of its own, beside the code and the error", () => {
    const entry = buildEntry({
      ...base,
      outcome: 500,
      code: "serverError",
      fault: "pathTooDeep",
      error: new Error("the walk did not reach the top"),
      added: { folderId: "3f2b8c1e" },
    });

    expect(entry).toMatchObject({
      level: "error",
      code: "serverError",
      fault: "pathTooDeep",
      folderId: "3f2b8c1e",
      error: { message: "the walk did not reach the top" },
    });
    expect(FAULTS).toEqual([
      "pathTooDeep",
      "answerTooLarge",
      "folderBusy",
      "storeRefused",
    ]);
    expect(buildEntry(base)).not.toHaveProperty("fault");
  });
});

describe("what counts as a server failure (observability design O21)", () => {
  beforeEach(() => {
    vi.stubEnv("POWERTOOLS_DEV", "true");
    vi.stubEnv("POWERTOOLS_METRICS_DISABLED", "false");
  });

  it.each([
    [200, 0],
    [304, 0],
    [404, 0],
    [500, 1],
  ])(
    "an answer with status %i counts %i server failures",
    (outcome, failures) => {
      const written = vi
        .spyOn(console, "log")
        .mockImplementation(() => undefined);

      createMeasurements("test").record({
        outcome,
        durationMs: 12,
        coldStart: false,
      });

      const line = JSON.parse(String(written.mock.calls[0]?.[0])) as Record<
        string,
        unknown
      >;
      expect(line.Requests).toBe(1);
      expect(line.ServerFailures).toBe(failures);
    },
  );
});
