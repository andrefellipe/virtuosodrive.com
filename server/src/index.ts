import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { createApp } from "./app.ts";
import type { App } from "./app.ts";
import { secretReader } from "./aws/secrets.ts";
import { loadConfig, readDatabaseCa } from "./config.ts";
import { rdsTokenProvider } from "./db/rds-token.ts";
import { problem, PROBLEM_CONTENT_TYPE } from "./http/problem.ts";
import { createMeasurements } from "./log/measurements.ts";
import { createRequestLog } from "./log/request-log.ts";

/**
 * The function's entry point. Everything that is done once per running copy
 * (reading settings, building the clients) happens on the copy's first
 * request and is kept (performance design P2).
 */

let app: App | undefined;

function startApp(): App {
  const config = loadConfig(process.env);
  return createApp({
    config,
    databaseCa: readDatabaseCa(),
    databaseToken: rdsTokenProvider({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      region: config.region,
    }),
    readOriginSecret: secretReader(
      new SecretsManagerClient({ region: config.region }),
      config.originSecretId,
    ),
    log: createRequestLog(),
    measurements: createMeasurements(config.environment),
  });
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (app === undefined) {
    try {
      app = startApp();
    } catch (error) {
      // A copy that cannot start has no settings to log with. Say why on
      // standard error, which the platform keeps, and answer as any failure.
      process.stderr.write(
        `The server could not start: ${error instanceof Error ? error.message : "unknown error"}\n`,
      );
      return {
        statusCode: 500,
        headers: {
          "content-type": PROBLEM_CONTENT_TYPE,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
        body: JSON.stringify(problem("serverError")),
      };
    }
  }
  return app.handle(event);
}
