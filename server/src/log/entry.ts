import type { ProblemCode } from "../http/problem.ts";
import { scrub } from "./scrub.ts";

export type Environment = "test" | "production";

/** The operation name recorded for a request refused for want of the edge's secret. */
export const ACCESS_REFUSED = "access refused";

/** The operation name recorded when the address is not an operation. */
export const UNKNOWN_OPERATION = "unknown";

export interface LoggedError {
  name: string;
  message: string;
  stack?: string;
}

/**
 * One entry per request (observability design O1). Entries are built from
 * these named fields only: no headers, no bodies, no query values.
 */
export interface RequestLogEntry {
  time: string;
  level: "info" | "error";
  requestId: string;
  operation: string;
  outcome: number;
  code?: ProblemCode;
  durationMs: number;
  version: string;
  environment: Environment;
  /** Always absent in this Unit; later Units fill it with the account's identifier. */
  account?: string;
  coldStart: boolean;
  error?: LoggedError;
}

export interface EntryInput {
  time: Date;
  requestId: string;
  operation: string;
  outcome: number;
  code?: ProblemCode;
  durationMs: number;
  version: string;
  environment: Environment;
  coldStart: boolean;
  /** The internal reason. Written only when the outcome is a server failure, or for a refusal's cause. */
  error?: unknown;
}

function describeError(error: unknown): LoggedError {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error
        ? ` (cause: ${error.cause.name}: ${error.cause.message})`
        : "";
    return {
      name: error.name,
      message: `${error.message}${cause}`,
      ...(error.stack === undefined ? {} : { stack: error.stack }),
    };
  }
  return { name: "NonError", message: String(error) };
}

/** Builds the entry, with email-shaped text already removed from every field. */
export function buildEntry(input: EntryInput): RequestLogEntry {
  const entry: RequestLogEntry = {
    time: input.time.toISOString(),
    level: input.outcome >= 500 ? "error" : "info",
    requestId: input.requestId,
    operation: input.operation,
    outcome: input.outcome,
    ...(input.code === undefined ? {} : { code: input.code }),
    durationMs: Math.max(0, Math.round(input.durationMs)),
    version: input.version,
    environment: input.environment,
    coldStart: input.coldStart,
    ...(input.error === undefined ? {} : { error: describeError(input.error) }),
  };
  return scrub(entry);
}
