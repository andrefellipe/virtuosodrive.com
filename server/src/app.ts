import type { ServerConfig } from "./config.ts";
import { Database } from "./db/database.ts";
import type { TokenProvider } from "./db/database.ts";
import { OriginSecretVerifier } from "./http/origin-secret.ts";
import type { SecretReader } from "./http/origin-secret.ts";
import { createRequestHandler } from "./http/request-steps.ts";
import type { RequestHandler } from "./http/request-steps.ts";
import type { Measurements } from "./log/measurements.ts";
import type { RequestLog } from "./log/request-log.ts";
import { allOperations } from "./operations/index.ts";

/**
 * What the server needs from outside itself. AWS services are passed in, so
 * tests replace them at the SDK's boundary; the database is always real.
 */
export interface AppDependencies {
  config: ServerConfig;
  /** The certificate authority the database's certificate must chain to. */
  databaseCa: string;
  databaseToken: TokenProvider;
  readOriginSecret: SecretReader;
  log: RequestLog;
  measurements: Measurements;
}

export interface App {
  handle: RequestHandler;
  /** Ends the kept database connection. */
  close(): Promise<void>;
}

/** Assembles one running copy of the server: one database connection, one list of operations. */
export function createApp(dependencies: AppDependencies): App {
  const { config } = dependencies;
  const database = new Database(
    {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      caCertificate: dependencies.databaseCa,
    },
    dependencies.databaseToken,
  );

  let cold = true;
  const handle = createRequestHandler({
    operations: allOperations({
      database,
      version: config.version,
      environment: config.environment,
      forcedFailure: config.forcedFailure,
    }),
    originSecret: new OriginSecretVerifier(dependencies.readOriginSecret),
    log: dependencies.log,
    measurements: dependencies.measurements,
    environment: config.environment,
    version: config.version,
    takeColdStart: () => {
      const wasCold = cold;
      cold = false;
      return wasCold;
    },
  });

  return { handle, close: () => database.close() };
}
