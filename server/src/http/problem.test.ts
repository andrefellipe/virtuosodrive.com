import { describe, expect, it } from "vitest";
import { OperationFailure, problem, PROBLEM_CODES } from "./problem.ts";

describe("problem", () => {
  it("gives each code the status contract C1 fixes for it", () => {
    expect(problem("invalidInput").status).toBe(400);
    expect(problem("notFound").status).toBe(404);
    expect(problem("serverError").status).toBe(500);
  });

  it("uses only the three codes this Unit answers with", () => {
    expect([...PROBLEM_CODES].sort()).toEqual([
      "invalidInput",
      "notFound",
      "serverError",
    ]);
  });

  it("has the required fields, a type naming the kind of problem, and a fixed detail", () => {
    const failure = problem("notFound");

    expect(Object.keys(failure).sort()).toEqual([
      "code",
      "detail",
      "status",
      "title",
      "type",
    ]);
    expect(failure.type).toBe("urn:virtuoso-drive:problem:not-found");
    expect(() => new URL(failure.type)).not.toThrow();
  });

  it("lets the health check answer serverError with 503", () => {
    expect(problem("serverError", 503)).toMatchObject({
      status: 503,
      code: "serverError",
    });
  });
});

describe("OperationFailure", () => {
  it("keeps the internal reason and cause for the log, with the code's own status by default", () => {
    const cause = new Error("timeout");
    const failure = new OperationFailure(
      "serverError",
      "database read failed",
      {
        cause,
      },
    );

    expect(failure.status).toBe(500);
    expect(failure.code).toBe("serverError");
    expect(failure.message).toBe("database read failed");
    expect(failure.cause).toBe(cause);
  });
});
