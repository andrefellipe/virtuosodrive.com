import { describe, expect, it } from "vitest";
import { buildEntry } from "./entry.ts";
import type { EntryInput } from "./entry.ts";

const base: EntryInput = {
  time: new Date("2026-12-01T14:03:22.118Z"),
  requestId: "7f3c",
  operation: "getSiteInformation",
  outcome: 200,
  durationMs: 41.4,
  version: "a1b2c3d",
  environment: "production",
  coldStart: false,
};

describe("buildEntry", () => {
  it("holds exactly the named fields for a success, with no account, code or error", () => {
    expect(buildEntry(base)).toEqual({
      time: "2026-12-01T14:03:22.118Z",
      level: "info",
      requestId: "7f3c",
      operation: "getSiteInformation",
      outcome: 200,
      durationMs: 41,
      version: "a1b2c3d",
      environment: "production",
      coldStart: false,
    });
  });

  it("is an error entry with the code and the internal reason when the outcome is 500 or above", () => {
    const cause = new Error("connection terminated");
    const entry = buildEntry({
      ...base,
      outcome: 503,
      code: "serverError",
      error: new Error("health read failed", { cause }),
    });

    expect(entry.level).toBe("error");
    expect(entry.code).toBe("serverError");
    expect(entry.error?.name).toBe("Error");
    expect(entry.error?.message).toBe(
      "health read failed (cause: Error: connection terminated)",
    );
    expect(entry.error?.stack).toContain("entry.test");
  });

  it("stays an info entry for a refusal or a client's mistake", () => {
    expect(buildEntry({ ...base, outcome: 403 }).level).toBe("info");
    expect(buildEntry({ ...base, outcome: 404, code: "notFound" }).level).toBe(
      "info",
    );
    expect(buildEntry({ ...base, outcome: 499 }).level).toBe("info");
    expect(buildEntry({ ...base, outcome: 500 }).level).toBe("error");
  });

  it("removes email-shaped text, including from an error's message and stack", () => {
    const error = new Error("no account for teacher@example.com");
    const entry = buildEntry({ ...base, outcome: 500, error });

    expect(error.stack).toContain("teacher@example.com");
    expect(JSON.stringify(entry)).not.toContain("teacher@example.com");
    expect(entry.error?.message).toBe("no account for [email removed]");
  });

  it("describes something thrown that is not an Error, and never reports a negative duration", () => {
    const entry = buildEntry({
      ...base,
      outcome: 500,
      durationMs: -5,
      error: "plain text thrown",
    });

    expect(entry.error).toEqual({
      name: "NonError",
      message: "plain text thrown",
    });
    expect(entry.durationMs).toBe(0);
  });
});
