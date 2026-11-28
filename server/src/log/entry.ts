import type { ProblemCode } from "../http/problem.ts";
import type { Fault } from "./fault.ts";
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

/** A value an operation may add to its entry. */
export type AddedValue = string | number | boolean;
export type AddedFieldType = "string" | "number" | "boolean";

/**
 * One entry per request (observability design O1). Entries are built from
 * these named fields, and from the fields an operation declares for itself
 * (observability design O20): no headers, no bodies, no query values.
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
  /** Which known fault the failure was, when it was one (observability design O22). */
  fault?: Fault;
  error?: LoggedError;
  /** The fields the request's operation declared and added. */
  [added: string]: unknown;
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
  fault?: Fault;
  /** The internal reason. Written only when the outcome is a server failure, or for a refusal's cause. */
  error?: unknown;
  /**
   * Fields added by the request's operation, already checked against what it
   * declared (see checkAddedFields). A field with the name of one of the
   * entry's own is left out: an operation cannot replace those.
   */
  added?: Readonly<Record<string, AddedValue>>;
}

/** The entry's own fields, which nothing an operation adds may replace. */
const OWN_FIELDS: ReadonlySet<string> = new Set([
  "time",
  "level",
  "requestId",
  "operation",
  "outcome",
  "code",
  "durationMs",
  "version",
  "environment",
  "account",
  "coldStart",
  "fault",
  "error",
]);

/**
 * Keeps, of what an operation wants to add to its entry, only the fields it
 * declared, and of those only the values of the declared type. Anything else
 * is dropped: a field that was never declared has not been thought about,
 * and must not reach the log by accident.
 */
export function checkAddedFields(
  declared: Readonly<Record<string, AddedFieldType>> | undefined,
  wanted: Readonly<Record<string, unknown>>,
): Record<string, AddedValue> {
  const kept: Record<string, AddedValue> = {};
  for (const [name, type] of Object.entries(declared ?? {})) {
    const value = wanted[name];
    if (
      !OWN_FIELDS.has(name) &&
      typeof value === type &&
      (type !== "number" || Number.isFinite(value))
    ) {
      kept[name] = value as AddedValue;
    }
  }
  return kept;
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
  const added = Object.fromEntries(
    Object.entries(input.added ?? {}).filter(([name]) => !OWN_FIELDS.has(name)),
  );
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
    ...added,
    ...(input.fault === undefined ? {} : { fault: input.fault }),
    ...(input.error === undefined ? {} : { error: describeError(input.error) }),
  };
  return scrub(entry);
}
