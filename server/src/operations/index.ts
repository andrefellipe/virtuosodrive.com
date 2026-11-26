import type { Database } from "../db/database.ts";
import type { Operation } from "../http/operation.ts";
import type { Environment } from "../log/entry.ts";
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
 * test reads it to check that every operation of this Unit is a GET, and
 * another checks it against the OpenAPI description.
 */
export function contractOperations(settings: OperationSettings): Operation[] {
  return [
    healthOperation(settings.database),
    siteInformationOperation(settings.database, {
      version: settings.version,
      environment: settings.environment,
    }),
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
