import { readFromServer } from "./call-server.ts";
import type { CallEnvironment, ReadResult } from "./call-server.ts";

/** The answer of GET /v1/site-information (entities: SiteStatus). */
export interface SiteStatusAnswer {
  installedAt: string;
  version: string;
  environment: "test" | "production";
}

/** Accepts the answer only if it has the expected fields; unknown fields are ignored. */
export function parseSiteStatus(body: unknown): SiteStatusAnswer | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const { installedAt, version, environment } = body as Record<string, unknown>;
  if (
    typeof installedAt !== "string" ||
    typeof version !== "string" ||
    version === "" ||
    (environment !== "test" && environment !== "production")
  ) {
    return undefined;
  }
  return { installedAt, version, environment };
}

export function readSiteInformation(
  environment?: CallEnvironment,
): Promise<ReadResult<SiteStatusAnswer>> {
  return readFromServer("/v1/site-information", parseSiteStatus, environment);
}
