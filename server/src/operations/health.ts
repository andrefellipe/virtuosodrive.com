import { z } from "zod";
import type { Database } from "../db/database.ts";
import { ping } from "../db/site-information.ts";
import { defineOperation } from "../http/operation.ts";
import type { Operation } from "../http/operation.ts";
import { OperationFailure } from "../http/problem.ts";

/**
 * GET /v1/health (contract C1). Says ok only when the server and its database
 * are answering, and says nothing else. A failure is a Problem with status
 * 503: the one place where serverError goes with a status other than 500
 * (rules BR1.3).
 */
export function healthOperation(database: Database): Operation {
  return defineOperation({
    name: "getHealth",
    method: "GET",
    path: "/v1/health",
    query: z.strictObject({}),
    healthCheck: true,
    async run() {
      try {
        await ping(database);
      } catch (error) {
        throw new OperationFailure(
          "serverError",
          "The health read of the database failed",
          { status: 503, cause: error },
        );
      }
      return { status: 200, body: { status: "ok" } };
    },
  });
}
