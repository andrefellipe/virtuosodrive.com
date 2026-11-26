import type { z } from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface OperationResult {
  status: number;
  body: unknown;
}

/**
 * One operation of the server. Operations are declared in one list, each with
 * its method, path and the shape of what it reads from the request. The
 * request steps, a test of the methods, and the check against the OpenAPI
 * description all read that list (security design S6).
 */
export interface Operation<Query extends z.ZodType = z.ZodType> {
  /** The name written in the log entry; never the address. */
  name: string;
  method: HttpMethod;
  /** The full path, starting with /v1/. */
  path: string;
  /** The shape of the query string. Strict: unknown parameters are refused. */
  query: Query;
  /** Health checks write their log entry but no measurements. */
  healthCheck?: boolean;
  run(input: { query: z.infer<Query> }): Promise<OperationResult>;
}

/** Keeps the query's type between the declared shape and run(). */
export function defineOperation<Query extends z.ZodType>(
  operation: Operation<Query>,
): Operation {
  return operation as unknown as Operation;
}

export function findOperation(
  operations: readonly Operation[],
  method: string,
  path: string,
): Operation | undefined {
  return operations.find(
    (operation) => operation.method === method && operation.path === path,
  );
}
