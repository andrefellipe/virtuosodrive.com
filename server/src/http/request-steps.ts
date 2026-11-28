import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import {
  ACCESS_REFUSED,
  buildEntry,
  checkAddedFields,
  UNKNOWN_OPERATION,
} from "../log/entry.ts";
import type { AddedValue, Environment } from "../log/entry.ts";
import type { Fault } from "../log/fault.ts";
import type { Measurements } from "../log/measurements.ts";
import type { RequestLog } from "../log/request-log.ts";
import { findOperationFor } from "./operation.ts";
import type {
  DeclaredHeaders,
  FoundOperation,
  Operation,
  OperationAnswer,
  OperationResult,
} from "./operation.ts";
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

/**
 * The largest response handed to the platform (scalability design C21). The
 * platform refuses 6 megabytes, measured on the whole response as one piece
 * of text: status, headers and body. The steps measure that very text and
 * refuse above 5.5 megabytes themselves, with a small answer and a named
 * fault, so that nothing between the two figures slips through unlogged.
 */
export const ANSWER_LIMIT_BYTES = 5.5 * 1024 * 1024;

interface Answer {
  response: APIGatewayProxyStructuredResultV2;
  operation: string;
  outcome: number;
  code?: ProblemCode;
  fault?: Fault;
  error?: unknown;
  /** What the operation added to its entry, already checked against what it declared. */
  added?: Record<string, AddedValue>;
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

/**
 * The response for an operation's own answer: its headers, and its body as
 * JSON, as text it prepared, as compressed bytes in the encoded form the
 * platform requires, or no body at all.
 */
function answerResponse(
  answer: OperationAnswer,
  requestId: string,
): APIGatewayProxyStructuredResultV2 {
  const named: Record<string, string> = {};
  for (const [name, value] of Object.entries(answer.headers ?? {})) {
    named[name.toLowerCase()] = value;
  }
  const fixed = { ...ALWAYS_SENT, [REQUEST_ID_HEADER]: requestId };
  const json = { "content-type": "application/json" };
  if (answer.prepared?.encoding === "gzip") {
    return {
      statusCode: answer.status,
      headers: { ...named, ...json, "content-encoding": "gzip", ...fixed },
      body: Buffer.from(answer.prepared.bytes).toString("base64"),
      isBase64Encoded: true,
    };
  }
  if (answer.prepared !== undefined) {
    return {
      statusCode: answer.status,
      headers: { ...named, ...json, ...fixed },
      body: answer.prepared.text,
    };
  }
  if (answer.body !== undefined) {
    return {
      statusCode: answer.status,
      headers: { ...named, ...json, ...fixed },
      body: JSON.stringify(answer.body),
    };
  }
  return { statusCode: answer.status, headers: { ...named, ...fixed } };
}

/** The size of a response exactly as the platform receives and measures it. */
function handedOverBytes(response: APIGatewayProxyStructuredResultV2): number {
  return Buffer.byteLength(JSON.stringify(response));
}

function problemAnswer(
  requestId: string,
  operation: string,
  failure: Problem,
  measured: boolean,
  details: Pick<Answer, "error" | "fault" | "added"> = {},
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
    ...(details.error === undefined ? {} : { error: details.error }),
    ...(details.fault === undefined ? {} : { fault: details.fault }),
    ...(details.added === undefined ? {} : { added: details.added }),
    measured,
  };
}

/** Only the request headers the operation declared; it sees no other. */
function declaredHeaders(
  operation: Operation,
  event: APIGatewayProxyEventV2,
): DeclaredHeaders {
  const handed: DeclaredHeaders = {};
  for (const name of operation.headers ?? []) {
    handed[name.toLowerCase()] = header(event, name.toLowerCase());
  }
  return handed;
}

async function runOperation(
  found: FoundOperation,
  event: APIGatewayProxyEventV2,
  requestId: string,
): Promise<Answer> {
  const { operation } = found;
  const measured = operation.healthCheck !== true;
  const headers = declaredHeaders(operation, event);
  const wanted: Record<string, unknown> = {};
  const added = (): Record<string, AddedValue> =>
    checkAddedFields(operation.logFields, wanted);

  // Step 4: validate what the operation reads from the request. The path's
  // values first: an operation may declare that a value which fails its
  // check is "no such thing", not a malformed request.
  let params: unknown = {};
  if (operation.params !== undefined) {
    const checked = operation.params.safeParse(found.pathValues);
    if (!checked.success) {
      const refusal = operation.invalidParams;
      Object.assign(wanted, refusal?.log?.(headers));
      return problemAnswer(
        requestId,
        operation.name,
        problem(refusal?.problem ?? "invalidInput"),
        measured,
        { added: added() },
      );
    }
    params = checked.data;
  }
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
    result = await operation.run({
      query: query.data,
      params,
      headers,
      log: (fields) => {
        Object.assign(wanted, fields);
      },
    });
  } catch (error) {
    const failure =
      error instanceof OperationFailure
        ? problem(error.code, error.status)
        : problem("serverError");
    if (failure.status >= 500) {
      Object.assign(wanted, operation.failureLog);
    }
    return problemAnswer(requestId, operation.name, failure, measured, {
      error,
      ...(error instanceof OperationFailure && error.fault !== undefined
        ? { fault: error.fault }
        : {}),
      added: added(),
    });
  }

  if ("problem" in result) {
    // A failure the operation answers on purpose: a Problem, and no error.
    Object.assign(wanted, result.log);
    return problemAnswer(
      requestId,
      operation.name,
      problem(result.problem),
      measured,
      { added: added() },
    );
  }

  // The response is built exactly as it will be handed over, and measured.
  const response = answerResponse(result, requestId);
  const size = handedOverBytes(response);
  if (size > ANSWER_LIMIT_BYTES) {
    Object.assign(wanted, operation.failureLog);
    return problemAnswer(
      requestId,
      operation.name,
      problem("serverError"),
      measured,
      {
        fault: "answerTooLarge",
        // The size is the steps' own to report, whatever the operation declared.
        added: { ...added(), answerBytes: size },
      },
    );
  }
  Object.assign(wanted, result.log);
  return {
    response,
    operation: operation.name,
    outcome: result.status,
    added: added(),
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
    const found = findOperationFor(
      dependencies.operations,
      event.requestContext.http.method,
      event.rawPath,
    );
    if (found === undefined) {
      return problemAnswer(
        requestId.value,
        UNKNOWN_OPERATION,
        problem("notFound"),
        true,
      );
    }
    return runOperation(found, event, requestId.value);
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
        { error },
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
          ...(outcome.fault === undefined ? {} : { fault: outcome.fault }),
          ...(outcome.error === undefined ? {} : { error: outcome.error }),
          ...(outcome.added === undefined ? {} : { added: outcome.added }),
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
