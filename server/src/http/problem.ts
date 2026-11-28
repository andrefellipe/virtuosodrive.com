import type { Fault } from "../log/fault.ts";

/**
 * The one shape every failure answer takes (contract C1). A Problem carries a
 * code and nothing internal: no name, address, query or stack trace. The
 * internal reason goes to the log entry only (rules BR1.5).
 */

/** The codes this Unit answers with, out of those contract C1 lists. */
export type ProblemCode = "invalidInput" | "notFound" | "serverError";

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: ProblemCode;
  detail?: string;
}

interface ProblemDefinition {
  status: number;
  title: string;
  detail: string;
}

const DEFINITIONS: Record<ProblemCode, ProblemDefinition> = {
  invalidInput: {
    status: 400,
    title: "Invalid input",
    detail: "The request was not in the form this operation accepts.",
  },
  notFound: {
    status: 404,
    title: "Not found",
    // One text for an unknown address and for a folder that is unknown,
    // deleted or hidden: the answers must not differ (security design S24).
    detail: "There is nothing at this address.",
  },
  serverError: {
    status: 500,
    title: "Server error",
    detail: "The server could not complete the request.",
  },
};

export const PROBLEM_CODES = Object.keys(DEFINITIONS) as ProblemCode[];

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

function kebabCase(code: string): string {
  return code.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Builds a Problem from its code. The status may be overridden only where the
 * contract says so: 503 for the health check (rules BR1.3).
 */
export function problem(code: ProblemCode, status?: number): Problem {
  const definition = DEFINITIONS[code];
  return {
    type: `urn:virtuoso-drive:problem:${kebabCase(code)}`,
    title: definition.title,
    status: status ?? definition.status,
    code,
    detail: definition.detail,
  };
}

/**
 * Thrown by an operation for a failure it recognises. The cause is the
 * internal reason; it is logged and never returned.
 */
export class OperationFailure extends Error {
  readonly code: ProblemCode;
  readonly status: number;
  /** The named fault this failure is, when it is one (observability design O22). */
  readonly fault: Fault | undefined;

  constructor(
    code: ProblemCode,
    internalReason: string,
    options: { status?: number; cause?: unknown; fault?: Fault } = {},
  ) {
    super(internalReason, { cause: options.cause });
    this.name = "OperationFailure";
    this.code = code;
    this.status = options.status ?? DEFINITIONS[code].status;
    this.fault = options.fault;
  }
}
