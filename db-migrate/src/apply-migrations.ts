import { runner } from "node-pg-migrate";
import type { ClientBase } from "pg";

/** The table in which node-pg-migrate records what has been applied. */
export const MIGRATIONS_TABLE = "pgmigrations";

/**
 * Applies the SQL files not yet recorded as applied, in order, each in its own
 * transaction, under a lock in the database so that two runs cannot overlap
 * (reliability design R3). Returns the names of the files this run applied.
 */
export async function applyMigrations(
  client: ClientBase,
  migrationsDir: string,
  log: (message: string) => void,
): Promise<string[]> {
  const applied = await runner({
    dbClient: client,
    dir: migrationsDir,
    direction: "up",
    migrationsTable: MIGRATIONS_TABLE,
    singleTransaction: false,
    checkOrder: true,
    noLock: false,
    log,
  });
  return applied.map((migration) => migration.name);
}
