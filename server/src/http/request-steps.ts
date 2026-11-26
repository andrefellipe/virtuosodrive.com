import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { ACCESS_REFUSED, buildEntry, UNKNOWN_OPERATION } from "../log/entry.ts";
import type { Environment } from "../log/entry.ts";
import type { Measurements } from "../log/measurements.ts";
import type { RequestLog } from "../log/request-log.ts";
import { findOperation } from "./operation.ts";
import type { Operation, OperationResult } from "./operation.ts";
import { ORIGIN_SECRET_HEADER } from "./origin-secret.ts";
import type { OriginSecretVerifier } from "./origin-secret.ts";
import { OperationFailure, problem, PROBLEM_CONTENT_TYPE } from "./problem.ts";
import type { Problem, ProblemCode } from "./problem.ts";
import { REQUEST_ID_HEADER, resolveRequestId } from "./request-id.ts";

export interface RequestStepsDependencies {
  operations: readonly Operation[];
  originSecret: Pick<OriginSecretVerifier, "check">;
  log: RequestLog;
  measurements: Measurements;
  environment: Environment;
  version: string;
  /** True for the first request a running copy serves. */
  takeColdStart: () => boolean;
  now?: () => number;
  generateRequestId?: () => string;
}

export type RequestHandler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyStructuredResultV2>;

interface Answer {
  response: APIGatewayProxyStructuredResultV2;
  operation: string;
  outcome: number;
  code?: ProblemCode;
  error?: unknown;
  measured: boolean;
}

const ALWAYS_SENT = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function header(
  event: APIGatewayProxyEventV2,
  name: string,
): string | undefined {
  // The entry point lower-cases header names; be tolerant of callers that do not.
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (key.toLowerCase() === name) {
      return value;
    }
  }
  return undefined;
}

function jsonResponse(
  status: number,
  body: unknown,
  contentType: string,
  requestId: string,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: {
      ...ALWAYS_SENT,
      "content-type": contentType,
      [REQUEST_ID_HEADER]: requestId,
    },
    body: JSON.stringify(body),
  };
}

function problemAnswer(
  requestId: string,
  operation: string,
  failure: Problem,
  measured: boolean,
  error?: unknown,
): Answer {
  return {
    response: jsonResponse(
      failure.status,
      failure,
      PROBLEM_CONTENT_TYPE,
      requestId,
    ),
    operation,
    outcome: failure.status,
    code: failure.code,
    ...(error === undefined ? {} : { error }),
    measured,
  };
}

async function runOperation(
  operation: Operation,
  event: APIGatewayProxyEventV2,
  requestId: string,
): Promise<Answer> {
  const measured = operation.healthCheck !== true;

  // Step 4: validate what the operation reads from the request.
  const query = operation.query.safeParse(event.queryStringParameters ?? {});
  if (!query.success) {
    return problemAnswer(
      requestId,
      operation.name,
      problem("invalidInput"),
      measured,
    );
  }

  // Steps 5 and 6: run the operation; turn any failure into a Problem.
  let result: OperationResult;
  try {
    result = await operation.run({ query: query.data });
  } catch (error) {
    const failure =
      error instanceof OperationFailure
        ? problem(error.code, error.status)
        : problem("serverError");
    return problemAnswer(requestId, operation.name, failure, measured, error);
  }
  return {
    response: jsonResponse(
      result.status,
      result.body,
      "application/json",
      requestId,
    ),
    operation: operation.name,
    outcome: result.status,
    measured,
  };
}

/**
 * The fixed sequence every request passes through, written once and shared by
 * all operations (security design S6). Later Units add operations, not steps.
 *
 *   1. Verify the edge's secret.          5. Run the operation.
 *   2. Take or make the request id.       6. Turn any failure into a Problem.
 *   3. Find the operation.                7. Write one log entry.
 *   4. Validate its input.
 */
export function createRequestHandler(
  dependencies: RequestStepsDependencies,
): RequestHandler {
  const now = dependencies.now ?? Date.now;

  async function answer(
    event: APIGatewayProxyEventV2,
    requestId: { value: string },
  ): Promise<Answer> {
    // Step 1.
    const origin = await dependencies.originSecret.check(
      header(event, ORIGIN_SECRET_HEADER),
    );
    if (!origin.allowed) {
      return {
        response: { statusCode: 403, headers: { ...ALWAYS_SENT } },
        operation: ACCESS_REFUSED,
        outcome: 403,
        ...(origin.rereadError === undefined
          ? {}
          : { error: origin.rereadError }),
        measured: false,
      };
    }

    // Step 2. What was sent is used only if it is well formed.
    requestId.value = resolveRequestId(
      header(event, REQUEST_ID_HEADER),
      dependencies.generateRequestId,
    );

    // Step 3.
    const operation = findOperation(
      dependencies.operations,
      event.requestContext.http.method,
      event.rawPath,
    );
    if (operation === undefined) {
      return problemAnswer(
        requestId.value,
        UNKNOWN_OPERATION,
        problem("notFound"),
        true,
      );
    }
    return runOperation(operation, event, requestId.value);
  }

  return async (event) => {
    const startedAt = now();
    const coldStart = dependencies.takeColdStart();
    const requestId = {
      value: resolveRequestId(undefined, dependencies.generateRequestId),
    };

    let outcome: Answer;
    try {
      outcome = await answer(event, requestId);
    } catch (error) {
      // Anything unexpected in the steps themselves.
      outcome = problemAnswer(
        requestId.value,
        UNKNOWN_OPERATION,
        problem("serverError"),
        false,
        error,
      );
    }

    // Step 7. A failure to log must not change the answer, and must not be silent.
    const durationMs = now() - startedAt;
    try {
      dependencies.log.write(
        buildEntry({
          time: new Date(startedAt),
          requestId: requestId.value,
          operation: outcome.operation,
          outcome: outcome.outcome,
          ...(outcome.code === undefined ? {} : { code: outcome.code }),
          durationMs,
          version: dependencies.version,
          environment: dependencies.environment,
          coldStart,
          ...(outcome.error === undefined ? {} : { error: outcome.error }),
        }),
      );
      if (outcome.measured) {
        dependencies.measurements.record({
          outcome: outcome.outcome,
          durationMs,
          coldStart,
        });
      }
    } catch (error) {
      process.stderr.write(
        `The request entry could not be written: ${error instanceof Error ? error.name : "unknown error"}\n`,
      );
    }
    return outcome.response;
  };
}
