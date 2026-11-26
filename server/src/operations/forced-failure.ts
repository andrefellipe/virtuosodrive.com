import { z } from "zod";
import { defineOperation } from "../http/operation.ts";
import type { Operation } from "../http/operation.ts";
import { OperationFailure } from "../http/problem.ts";

/**
 * GET /v1/forced-failure. Fails on purpose, so that the error-rate alarm can
 * be proved once in the test environment (observability design O5). It is
 * part of the server only when the environment's configuration enables it,
 * which production's never does; otherwise the address answers notFound like
 * any other unknown one. It is not part of the contract.
 */
export function forcedFailureOperation(): Operation {
  return defineOperation({
    name: "forceFailure",
    method: "GET",
    path: "/v1/forced-failure",
    query: z.strictObject({}),
    async run() {
      throw new OperationFailure(
        "serverError",
        "Forced failure, to prove the error-rate alarm",
      );
    },
  });
}
