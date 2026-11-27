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
import { SIGN_IN_TRY_LIMIT_MS, signIn } from "./sign-in.ts";
import type { Credentials } from "./sign-in.ts";

/**
 * The change runner function's entry point. The pipeline starts it and waits
 * for its answer; a thrown error fails the Deployment before the new version
 * of the server is put in place.
 *
 * How patiently it signs in to the database is in `sign-in.ts`.
 */

const CA_FILE = fileURLToPath(
  new URL("../certs/rds-us-east-1-bundle.pem", import.meta.url),
);

const logger = new Logger({ serviceName: "db-migrate", logLevel: "INFO" });

/** A connection made but not yet opened; `signIn` opens it, or closes it. */
function createConnection(
  config: RunnerConfig,
  credentials: Credentials,
): Client {
  const client = new Client({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: credentials.user,
    password: credentials.password,
    ssl: {
      ca: readFileSync(CA_FILE, "utf8"),
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
    connectionTimeoutMillis: SIGN_IN_TRY_LIMIT_MS,
    application_name: "virtuoso-drive-db-migrate",
  });
  // Without a listener, an error on an idle connection would stop the process.
  client.on("error", (error) => {
    logger.warn("A database connection reported an error", {
      reason: error.message,
    });
  });
  return client;
}

/** A sign-in token made from the function's own identity; new at every call. */
async function migratorCredentials(config: RunnerConfig): Promise<Credentials> {
  const token = await new Signer({
    hostname: config.database.host,
    port: config.database.port,
    username: "migrator",
    region: config.region,
  }).getAuthToken();
  return { user: "migrator", password: token };
}

async function masterCredentials(config: RunnerConfig): Promise<Credentials> {
  const secrets = new SecretsManagerClient({ region: config.region });
  const answer = await secrets.send(
    new GetSecretValueCommand({ SecretId: config.masterSecretId }),
  );
  if (answer.SecretString === undefined) {
    throw new Error("The database master secret has no text value");
  }
  const master = parseMasterSecret(answer.SecretString);
  return { user: master.username, password: master.password };
}

function connectAsMigrator(config: RunnerConfig): Promise<Client> {
  return signIn({
    who: '"migrator"',
    getCredentials: () => migratorCredentials(config),
    createConnection: (credentials) => createConnection(config, credentials),
    log: (message) => logger.warn(message),
  });
}

function connectAsMaster(config: RunnerConfig): Promise<Client> {
  return signIn({
    who: "the master user",
    getCredentials: () => masterCredentials(config),
    createConnection: (credentials) => createConnection(config, credentials),
    log: (message) => logger.warn(message),
  });
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
