import { describe, expect, it } from "vitest";
import { Database } from "../db/database.ts";
import { allOperations, contractOperations } from "./index.ts";
import type { OperationSettings } from "./index.ts";

// The list is only read here; no operation is run, so the database is never asked.
function settings(
  overrides: Partial<OperationSettings> = {},
): OperationSettings {
  return {
    database: new Database(
      {
        host: "db.example.com",
        port: 5432,
        database: "virtuoso",
        user: "app",
        caCertificate: "",
      },
      () => Promise.reject(new Error("not used in this test")),
    ),
    version: "a1b2c3d",
    environment: "test",
    forcedFailure: false,
    ...overrides,
  };
}

describe("the declared list of operations", () => {
  it("holds the health check and site information, and nothing else", () => {
    expect(
      contractOperations(settings()).map((operation) => [
        operation.name,
        operation.method,
        operation.path,
      ]),
    ).toEqual([
      ["getHealth", "GET", "/v1/health"],
      ["getSiteInformation", "GET", "/v1/site-information"],
    ]);
  });

  it("contains only GET, in every configuration", () => {
    for (const configuration of [
      settings(),
      settings({ forcedFailure: true }),
      settings({ environment: "production" }),
    ]) {
      const methods = allOperations(configuration).map(
        (operation) => operation.method,
      );
      expect(methods.length).toBeGreaterThan(0);
      expect(methods.every((method) => method === "GET")).toBe(true);
    }
  });

  it("has a different name and address for every operation, all under /v1/ in kebab-case", () => {
    const operations = allOperations(settings({ forcedFailure: true }));

    expect(new Set(operations.map((operation) => operation.name)).size).toBe(
      operations.length,
    );
    expect(new Set(operations.map((operation) => operation.path)).size).toBe(
      operations.length,
    );
    for (const operation of operations) {
      expect(operation.path).toMatch(/^\/v1\/[a-z]+(-[a-z]+)*$/);
    }
  });

  it("marks only the health check as one, so only it is left out of the measurements", () => {
    const flagged = allOperations(settings({ forcedFailure: true }))
      .filter((operation) => operation.healthCheck === true)
      .map((operation) => operation.name);

    expect(flagged).toEqual(["getHealth"]);
  });

  it("adds the deliberately failing operation only when the test environment enables it", () => {
    const names = (configuration: OperationSettings): string[] =>
      allOperations(configuration).map((operation) => operation.name);

    expect(names(settings())).not.toContain("forceFailure");
    expect(names(settings({ forcedFailure: true }))).toContain("forceFailure");
  });

  it("never adds the deliberately failing operation in production, even if asked", () => {
    const operations = allOperations(
      settings({ environment: "production", forcedFailure: true }),
    );

    expect(operations.map((operation) => operation.name)).toEqual([
      "getHealth",
      "getSiteInformation",
    ]);
  });
});
