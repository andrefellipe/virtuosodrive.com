import { describe, expect, it } from "vitest";
import { Database } from "../db/database.ts";
import { pathParameterNames } from "../http/operation.ts";
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
  // U3 added the folder read to this list; the three tests that spell the
  // list out were brought up to date with it, and assert as strictly as before.
  it("holds the health check, site information and the folder read, and nothing else", () => {
    expect(
      contractOperations(settings()).map((operation) => [
        operation.name,
        operation.method,
        operation.path,
      ]),
    ).toEqual([
      ["getHealth", "GET", "/v1/health"],
      ["getSiteInformation", "GET", "/v1/site-information"],
      ["getFolder", "GET", "/v1/folders/{folderId}"],
    ]);
  });

  it("adds exactly one operation in U3, which only reads; no route reaches the name operations or the change step", () => {
    const added = allOperations(settings({ forcedFailure: true })).filter(
      (operation) =>
        !["getHealth", "getSiteInformation", "forceFailure"].includes(
          operation.name,
        ),
    );

    expect(
      added.map((operation) => [operation.name, operation.method]),
    ).toEqual([["getFolder", "GET"]]);
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
      // Fixed parts in kebab-case; a named part, in braces, in camelCase.
      expect(operation.path).toMatch(
        /^\/v1\/[a-z]+(-[a-z]+)*(\/(\{[a-z][A-Za-z0-9]*\}|[a-z]+(-[a-z]+)*))*$/,
      );
    }
  });

  it("declares a check for the values of every path that has named parts, and for no other", () => {
    for (const operation of allOperations(settings({ forcedFailure: true }))) {
      expect(operation.params !== undefined).toBe(
        pathParameterNames(operation.path).length > 0,
      );
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
      "getFolder",
    ]);
  });
});
