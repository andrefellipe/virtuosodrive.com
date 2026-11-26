import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * The server's settings. Environment variables hold non-secret settings only
 * (the environment's name, the database's address, the names of secrets);
 * secret values are read from Secrets Manager when a copy starts.
 */

const onOff = z.enum(["on", "off"]).transform((value) => value === "on");

const settingsShape = z.object({
  VD_ENVIRONMENT: z.enum(["test", "production"]),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65_535).default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  ORIGIN_SECRET_ID: z.string().min(1),
  AWS_REGION: z.string().min(1),
  /** Enables the operation that fails on purpose, to prove the error-rate alarm. Never on in production. */
  VD_FORCED_FAILURE: onOff.default(false),
});

export interface ServerConfig {
  environment: "test" | "production";
  version: string;
  region: string;
  database: { host: string; port: number; name: string; user: string };
  originSecretId: string;
  forcedFailure: boolean;
}

// These files sit one folder above this one, both in the repository
// (server/src -> server) and inside the function's package (src -> package root).
const RELEASE_FILE = fileURLToPath(new URL("../release.json", import.meta.url));
const CA_FILE = fileURLToPath(
  new URL("../certs/rds-us-east-1-bundle.pem", import.meta.url),
);

const releaseShape = z.object({ version: z.string().min(1).max(64) });

/** The Release's version, written into the package when the Release is built. */
export function readReleaseVersion(file: string = RELEASE_FILE): string {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Not a built Release: the code is being run from the repository.
      return "development";
    }
    throw error;
  }
  return releaseShape.parse(JSON.parse(text)).version;
}

/** The certificate authorities Amazon RDS publishes for the Region. */
export function readDatabaseCa(file: string = CA_FILE): string {
  return readFileSync(file, "utf8");
}

export function loadConfig(
  environment: Record<string, string | undefined>,
  version: string = readReleaseVersion(),
): ServerConfig {
  const parsed = settingsShape.safeParse(environment);
  if (!parsed.success) {
    const names = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`The server's settings are missing or malformed: ${names}`);
  }
  const settings = parsed.data;
  if (settings.VD_FORCED_FAILURE && settings.VD_ENVIRONMENT === "production") {
    throw new Error("VD_FORCED_FAILURE must never be on in production");
  }
  return {
    environment: settings.VD_ENVIRONMENT,
    version,
    region: settings.AWS_REGION,
    database: {
      host: settings.DB_HOST,
      port: settings.DB_PORT,
      name: settings.DB_NAME,
      user: settings.DB_USER,
    },
    originSecretId: settings.ORIGIN_SECRET_ID,
    forcedFailure: settings.VD_FORCED_FAILURE,
  };
}
