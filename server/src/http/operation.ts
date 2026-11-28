import type { z } from "zod";
import type { ProblemCode } from "./problem.ts";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** What an operation may add to its log entry: plain values only. */
export type LogValue = string | number | boolean;
export type LogFieldType = "string" | "number" | "boolean";
export type LogFields = Record<string, LogValue>;

/**
 * A body the operation prepared itself, as JSON text: plain, or compressed
 * with gzip. The request steps pass a compressed body on in the encoded form
 * the platform requires.
 */
export type PreparedBody =
  | { encoding: "identity"; text: string }
  | { encoding: "gzip"; bytes: Uint8Array };

/** An answer with a status. With neither `body` nor `prepared` it has no body at all. */
export interface OperationAnswer {
  status: number;
  /** A value the request steps send as JSON. */
  body?: unknown;
  /** Instead of `body`: JSON the operation has already written out, and perhaps compressed. */
  prepared?: PreparedBody;
  /**
   * Response headers the operation names. They cannot replace the headers
   * every answer carries, the content type, or the request identifier.
   */
  headers?: Record<string, string>;
  /** Fields for the log entry, from those the operation declares. */
  log?: LogFields;
}

/**
 * A failure the operation answers on purpose, as the Problem of that code.
 * Unlike a thrown failure it is no error: nothing internal is logged.
 */
export interface OperationProblem {
  problem: ProblemCode;
  log?: LogFields;
}

export type OperationResult = OperationAnswer | OperationProblem;

/** The request headers an operation declared, by lower-case name; undefined when not sent. */
export type DeclaredHeaders = Record<string, string | undefined>;

export interface OperationInput<Query, Params> {
  query: Query;
  /** The values of the path's named parts, after the operation's check. */
  params: Params;
  /** Only the headers the operation declared. It sees no other. */
  headers: DeclaredHeaders;
  /** Adds fields to the request's log entry, whatever the outcome turns out to be. */
  log(fields: LogFields): void;
}

/**
 * One operation of the server. Operations are declared in one list, each with
 * its method, path and the shape of what it reads from the request. The
 * request steps, a test of the methods, and the check against the OpenAPI
 * description all read that list (security design S6).
 */
export interface Operation<
  Query extends z.ZodType = z.ZodType,
  Params extends z.ZodType = z.ZodType,
> {
  /** The name written in the log entry; never the address. */
  name: string;
  method: HttpMethod;
  /**
   * The full path, starting with /v1/. A part written in braces, as in
   * /v1/folders/{folderId}, is a named part: it matches any one part of an
   * address, and its value is handed to the operation after `params` has
   * checked it.
   */
  path: string;
  /** The shape of the query string. Strict: unknown parameters are refused. */
  query: Query;
  /** The shape of the path's named parts. Needed exactly when the path has any. */
  params?: Params;
  /**
   * How a failed check of the path's values is answered. Left out: with
   * `invalidInput`, like any other input. An operation whose answer must not
   * teach what its identifiers look like declares "notFound" (security
   * design S20), and may say what its log entry then carries.
   */
  invalidParams?: {
    problem: "notFound";
    log?: (headers: DeclaredHeaders) => LogFields;
  };
  /** The request headers the operation reads, in lower case. */
  headers?: readonly string[];
  /** The fields the operation may add to its log entry, with their types. */
  logFields?: Readonly<Record<string, LogFieldType>>;
  /** Added to the log entry whenever the operation's request ends as a server failure. */
  failureLog?: LogFields;
  /** Health checks write their log entry but no measurements. */
  healthCheck?: boolean;
  run(
    input: OperationInput<z.infer<Query>, z.infer<Params>>,
  ): Promise<OperationResult>;
}

/** Keeps the types of the query and the path's values between the declared shapes and run(). */
export function defineOperation<
  Query extends z.ZodType,
  Params extends z.ZodType = z.ZodType,
>(operation: Operation<Query, Params>): Operation {
  return operation as unknown as Operation;
}

const NAMED_PART = /^\{([A-Za-z][A-Za-z0-9]*)\}$/;

/** The names of a path's named parts, in order. */
export function pathParameterNames(path: string): string[] {
  return path
    .split("/")
    .map((part) => NAMED_PART.exec(part)?.[1])
    .filter((name) => name !== undefined);
}

/**
 * Whether an address is this path, and if so the values of its named parts
 * exactly as they were sent. A named part never matches an empty part or
 * more than one part.
 */
export function matchPath(
  template: string,
  path: string,
): Record<string, string> | undefined {
  const templateParts = template.split("/");
  const parts = path.split("/");
  if (templateParts.length !== parts.length) {
    return undefined;
  }
  const values: Record<string, string> = {};
  for (const [index, templatePart] of templateParts.entries()) {
    const part = parts[index] as string;
    const name = NAMED_PART.exec(templatePart)?.[1];
    if (name === undefined) {
      if (templatePart !== part) {
        return undefined;
      }
    } else if (part === "") {
      return undefined;
    } else {
      values[name] = part;
    }
  }
  return values;
}

export interface FoundOperation {
  operation: Operation;
  /** The values of the path's named parts, not yet checked. */
  pathValues: Record<string, string>;
}

/** The operation for a request, and the values of its path's named parts. */
export function findOperationFor(
  operations: readonly Operation[],
  method: string,
  path: string,
): FoundOperation | undefined {
  for (const operation of operations) {
    if (operation.method !== method) {
      continue;
    }
    const pathValues = matchPath(operation.path, path);
    if (pathValues !== undefined) {
      return { operation, pathValues };
    }
  }
  return undefined;
}

export function findOperation(
  operations: readonly Operation[],
  method: string,
  path: string,
): Operation | undefined {
  return findOperationFor(operations, method, path)?.operation;
}
