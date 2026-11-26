import { z } from "zod";
import type { Database } from "../db/database.ts";
import { getSiteInformation } from "../db/site-information.ts";
import { defineOperation } from "../http/operation.ts";
import type { Operation } from "../http/operation.ts";
import { OperationFailure } from "../http/problem.ts";
import type { Environment } from "../log/entry.ts";

/** The answer to the slice's one server call (entities: SiteStatus). */
export interface SiteStatus {
  installedAt: string;
  version: string;
  environment: Environment;
}

/**
 * GET /v1/site-information. Answers with the installed time, the running
 * version and the environment, and only if the database read succeeded
 * (rules BR1.1). This is the working example later Units copy for an
 * operation: declared shape, one database access, failures left to the
 * request steps.
 */
export function siteInformationOperation(
  database: Database,
  release: { version: string; environment: Environment },
): Operation {
  return defineOperation({
    name: "getSiteInformation",
    method: "GET",
    path: "/v1/site-information",
    query: z.strictObject({}),
    async run() {
      const information = await getSiteInformation(database);
      if (information === undefined) {
        throw new OperationFailure(
          "serverError",
          "The site_information record is missing: the first database change was not applied",
        );
      }
      const body: SiteStatus = {
        installedAt: information.installedAt.toISOString(),
        version: release.version,
        environment: release.environment,
      };
      return { status: 200, body };
    },
  });
}
