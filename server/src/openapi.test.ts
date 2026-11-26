import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Database } from "./db/database.ts";
import { PROBLEM_CODES } from "./http/problem.ts";
import { contractOperations } from "./operations/index.ts";

const OPENAPI_FILE = fileURLToPath(new URL("../openapi.yaml", import.meta.url));
const SERVER_PREFIX = "/v1";

interface DescribedOperation {
  path: string;
  method: string;
  operationId: string | undefined;
}

/**
 * Reads what this test needs from the OpenAPI file by its indentation: under
 * "paths:", a key indented two spaces is a path, a key indented four is a
 * method, and "operationId" sits six in. The file is written in that plain
 * block style on purpose, so that no YAML library is needed to check it.
 */
function describedOperations(text: string): DescribedOperation[] {
  const operations: DescribedOperation[] = [];
  let inPaths = false;
  let path = "";
  for (const line of text.split("\n")) {
    if (/^\S/.test(line)) {
      inPaths = line.startsWith("paths:");
      continue;
    }
    if (!inPaths) {
      continue;
    }
    const pathKey = /^ {2}(\/\S*):\s*$/.exec(line);
    const methodKey = /^ {4}([a-z]+):\s*$/.exec(line);
    const operationId = /^ {6}operationId:\s*(\S+)\s*$/.exec(line);
    if (pathKey?.[1] !== undefined) {
      path = pathKey[1];
    } else if (methodKey?.[1] !== undefined) {
      operations.push({
        path,
        method: methodKey[1].toUpperCase(),
        operationId: undefined,
      });
    } else if (operationId?.[1] !== undefined) {
      const last = operations.at(-1);
      if (last !== undefined) {
        last.operationId = operationId[1];
      }
    }
  }
  return operations;
}

function problemCodes(text: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^ {4}Problem:\s*$/.test(line));
  const enumStart = lines.findIndex(
    (line, index) => index > start && /^\s+enum:\s*$/.test(line),
  );
  const codes: string[] = [];
  for (const line of lines.slice(enumStart + 1)) {
    const item = /^\s+- (\w+)\s*$/.exec(line);
    if (item?.[1] === undefined) {
      break;
    }
    codes.push(item[1]);
  }
  return codes;
}

describe("the OpenAPI description", () => {
  const text = readFileSync(OPENAPI_FILE, "utf8");

  it("describes exactly the declared operations: same addresses, methods and names", () => {
    const declared = contractOperations({
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
    }).map((operation) => ({
      path: operation.path,
      method: operation.method,
      operationId: operation.name,
    }));

    const described = describedOperations(text).map((operation) => ({
      ...operation,
      path: `${SERVER_PREFIX}${operation.path}`,
    }));

    expect(described.length).toBeGreaterThan(0);
    expect(described).toEqual(declared);
    expect(text).toContain("- url: https://virtuoso.andrefellipelabs.com/v1");
  });

  it("lists exactly the Problem codes the server answers with, and the Problem's required fields", () => {
    expect(problemCodes(text).sort()).toEqual([...PROBLEM_CODES].sort());
    expect(text).toContain("required: [type, title, status, code]");
    expect(text).toContain("application/problem+json");
  });
});
