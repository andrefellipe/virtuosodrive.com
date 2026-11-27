import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { Signer } from "@aws-sdk/rds-signer";
import { Client } from "pg";
import { loadConfig, parseMasterSecret } from "./config.ts";
import type { RunnerConfig } from "./config.ts";
import { CREATE_USERS_FILE, MIGRATIONS_DIR, REHEARSAL_DIR } from "./paths.ts";
import { runChanges } from "./runner.ts";
import type { RunReport } from "./runner.ts";

/**
 * The change runner function's entry point. The pipeline starts it and waits
 * for its answer; a thrown error fails the Deployment before the new version
 * of the server is put in place.
 */

const CA_FILE = fileURLToPath(
  new URL("../certs/rds-us-east-1-bundle.pem", import.meta.url),
);
const CONNECT_LIMIT_MS = 10_000;

const logger = new Logger({ serviceName: "db-migrate", logLevel: "INFO" });

function connect(
  config: RunnerConfig,
  user: string,
  password: string,
): Promise<Client> {
  const client = new Client({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user,
    password,
    ssl: {
      ca: readFileSync(CA_FILE, "utf8"),
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
    connectionTimeoutMillis: CONNECT_LIMIT_MS,
    application_name: "virtuoso-drive-db-migrate",
  });
  // Without a listener, an error on an idle connection would stop the process.
  client.on("error", (error) => {
    logger.warn("A database connection reported an error", {
      reason: error.message,
    });
  });
  return client.connect().then(
    () => client,
    async (error: unknown) => {
      await client.end().catch(() => undefined);
      throw error;
    },
  );
}

async function connectAsMigrator(config: RunnerConfig): Promise<Client> {
  const token = await new Signer({
    hostname: config.database.host,
    port: config.database.port,
    username: "migrator",
    region: config.region,
  }).getAuthToken();
  return connect(config, "migrator", token);
}

async function connectAsMaster(config: RunnerConfig): Promise<Client> {
  const secrets = new SecretsManagerClient({ region: config.region });
  const answer = await secrets.send(
    new GetSecretValueCommand({ SecretId: config.masterSecretId }),
  );
  if (answer.SecretString === undefined) {
    throw new Error("The database master secret has no text value");
  }
  const master = parseMasterSecret(answer.SecretString);
  return connect(config, master.username, master.password);
}

export async function handler(): Promise<RunReport> {
  const config = loadConfig(process.env);
  try {
    const report = await runChanges({
      connectAsMigrator: () => connectAsMigrator(config),
      connectAsMaster: () => connectAsMaster(config),
      migrationsDir: MIGRATIONS_DIR,
      createUsersSql: readFileSync(CREATE_USERS_FILE, "utf8"),
      // Test only: the settings refuse the switch in production.
      ...(config.failingChange ? { rehearsalDir: REHEARSAL_DIR } : {}),
      log: (message) => logger.info(message),
    });
    logger.info("Database changes finished", { ...report });
    return report;
  } catch (error) {
    logger.error("Database changes failed", error as Error);
    throw error;
  }
}
