import { z } from "zod";

/**
 * The change runner's settings: non-secret values from environment variables.
 * The master sign-in is read from Secrets Manager only when a new
 * environment's users must be created.
 */

const settingsShape = z.object({
  VD_ENVIRONMENT: z.enum(["test", "production"]),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65_535).default(5432),
  DB_NAME: z.string().min(1),
  DB_MASTER_SECRET_ID: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

export interface RunnerConfig {
  environment: "test" | "production";
  region: string;
  database: { host: string; port: number; name: string };
  masterSecretId: string;
}

export function loadConfig(
  environment: Record<string, string | undefined>,
): RunnerConfig {
  const parsed = settingsShape.safeParse(environment);
  if (!parsed.success) {
    const names = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `The change runner's settings are missing or malformed: ${names}`,
    );
  }
  const settings = parsed.data;
  return {
    environment: settings.VD_ENVIRONMENT,
    region: settings.AWS_REGION,
    database: {
      host: settings.DB_HOST,
      port: settings.DB_PORT,
      name: settings.DB_NAME,
    },
    masterSecretId: settings.DB_MASTER_SECRET_ID,
  };
}

const masterSecretShape = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export interface MasterSignIn {
  username: string;
  password: string;
}

/** Reads the master sign-in from the secret's text, without ever echoing it in an error. */
export function parseMasterSecret(secretText: string): MasterSignIn {
  let value: unknown;
  try {
    value = JSON.parse(secretText);
  } catch {
    throw new Error("The database master secret is not valid JSON");
  }
  const parsed = masterSecretShape.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      'The database master secret must hold "username" and "password"',
    );
  }
  return parsed.data;
}
