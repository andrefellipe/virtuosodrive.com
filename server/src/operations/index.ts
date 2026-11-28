import type { Database } from "../db/database.ts";
import type { Operation } from "../http/operation.ts";
import type { Environment } from "../log/entry.ts";
import { folderOperation } from "./folder.ts";
import { forcedFailureOperation } from "./forced-failure.ts";
import { healthOperation } from "./health.ts";
import { siteInformationOperation } from "./site-information.ts";

export interface OperationSettings {
  database: Database;
  version: string;
  environment: Environment;
  /** Adds the deliberately failing operation; never in production. */
  forcedFailure: boolean;
}

/**
 * The one declared list of operations. The request steps route from it; a
 * test reads it to check that every operation is a GET, and another checks
 * it against the OpenAPI description.
 *
 * The name operations and the change step of the Drive module are not in
 * this list and are reached from no operation (security design S25): in U3
 * the server only reads.
 */
export function contractOperations(settings: OperationSettings): Operation[] {
  return [
    healthOperation(settings.database),
    siteInformationOperation(settings.database, {
      version: settings.version,
      environment: settings.environment,
    }),
    folderOperation(settings.database),
  ];
}

/** Everything the server answers: the contract's operations, plus the alarm proof when enabled. */
export function allOperations(settings: OperationSettings): Operation[] {
  const enabled =
    settings.forcedFailure && settings.environment !== "production";
  return [
    ...contractOperations(settings),
    ...(enabled ? [forcedFailureOperation()] : []),
  ];
}
