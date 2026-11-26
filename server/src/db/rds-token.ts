import { Signer } from "@aws-sdk/rds-signer";
import type { SignerConfig } from "@aws-sdk/rds-signer";
import type { TokenProvider } from "./database.ts";

export interface RdsTokenSettings {
  host: string;
  port: number;
  user: string;
  region: string;
  /** Only tests pass credentials; on AWS the function's own identity is used. */
  credentials?: SignerConfig["credentials"];
}

/**
 * A sign-in token for Amazon RDS made from the function's own identity, valid
 * for 15 minutes. It is computed locally; no call leaves the function, so it
 * works in a network with no route to the internet. No database password exists.
 */
export function rdsTokenProvider(settings: RdsTokenSettings): TokenProvider {
  const signer = new Signer({
    hostname: settings.host,
    port: settings.port,
    username: settings.user,
    region: settings.region,
    ...(settings.credentials === undefined
      ? {}
      : { credentials: settings.credentials }),
  });
  return () => signer.getAuthToken();
}
