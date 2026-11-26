import type { Client } from "pg";
import { applyMigrations } from "./apply-migrations.ts";
import { decideUserCreation, isSignInRefusal } from "./decide.ts";
import type { ExistingUsers } from "./decide.ts";

export interface RunnerDependencies {
  /** Opens a connection as the owner of the structure, by AWS identity. */
  connectAsMigrator(): Promise<Client>;
  /** Opens a connection with the master sign-in. Used only for a new environment. */
  connectAsMaster(): Promise<Client>;
  migrationsDir: string;
  /** The statement that creates the users "app" and "migrator". */
  createUsersSql: string;
  log(message: string): void;
}

export interface RunReport {
  /** Whether this run created the database users (a new environment). */
  createdUsers: boolean;
  /** The names of the SQL files this run applied, in order. */
  applied: string[];
}

async function end(
  client: Client,
  log: (message: string) => void,
): Promise<void> {
  try {
    await client.end();
  } catch (error) {
    log(
      `Closing a database connection failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

async function existingUsers(master: Client): Promise<ExistingUsers> {
  const found = await master.query<{ rolname: string }>(
    "SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[])",
    [["migrator", "app"]],
  );
  const names = new Set(found.rows.map((row) => row.rolname));
  return { migrator: names.has("migrator"), app: names.has("app") };
}

async function createUsersIfNew(
  dependencies: RunnerDependencies,
): Promise<void> {
  const master = await dependencies.connectAsMaster();
  try {
    const decision = decideUserCreation(await existingUsers(master));
    if (decision.action === "stop") {
      throw new Error(decision.reason);
    }
    dependencies.log('Creating the database users "app" and "migrator"');
    await master.query("BEGIN");
    try {
      await master.query(dependencies.createUsersSql);
      await master.query("COMMIT");
    } catch (error) {
      await master.query("ROLLBACK");
      throw error;
    }
  } finally {
    await end(master, dependencies.log);
  }
}

/**
 * One run of the change runner: sign in as "migrator"; only if that sign-in
 * is refused and the master sign-in confirms the users do not exist, create
 * them first; then take the lock and apply the pending files. Running it
 * again is harmless: files already applied are recorded and skipped.
 */
export async function runChanges(
  dependencies: RunnerDependencies,
): Promise<RunReport> {
  let createdUsers = false;
  let migrator: Client;
  try {
    migrator = await dependencies.connectAsMigrator();
  } catch (error) {
    if (!isSignInRefusal(error)) {
      throw error;
    }
    dependencies.log(
      'Signing in as "migrator" was refused; checking with the master sign-in whether this is a new environment',
    );
    await createUsersIfNew(dependencies);
    createdUsers = true;
    migrator = await dependencies.connectAsMigrator();
  }

  try {
    const applied = await applyMigrations(
      migrator,
      dependencies.migrationsDir,
      dependencies.log,
    );
    return { createdUsers, applied };
  } finally {
    await end(migrator, dependencies.log);
  }
}
