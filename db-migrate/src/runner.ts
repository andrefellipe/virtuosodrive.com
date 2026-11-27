import type { Client } from "pg";
import { applyFailingChange, applyMigrations } from "./apply-migrations.ts";
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
  /**
   * Only for the rehearsal of a failing deployment, in the test environment:
   * the folder holding the change that fails on purpose. When given, it is
   * applied after the real pending changes and the run fails. Left out in
   * every ordinary run.
   */
  rehearsalDir?: string;
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
 *
 * With a rehearsal folder given, the run then applies the change that fails
 * on purpose, and fails.
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
    if (dependencies.rehearsalDir !== undefined) {
      // Each real change above was committed in its own transaction and
      // stays applied, as it would if a later real change failed.
      dependencies.log(
        `Rehearsal: applying the change that fails on purpose. Real changes applied first, which stay applied: ${applied.length === 0 ? "none" : applied.join(", ")}`,
      );
      await applyFailingChange(
        migrator,
        dependencies.rehearsalDir,
        dependencies.log,
      );
    }
    return { createdUsers, applied };
  } finally {
    await end(migrator, dependencies.log);
  }
}
