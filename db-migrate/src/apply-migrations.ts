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

/** What the rehearsal's failing change says when it fails, as its file writes it. */
export const REHEARSAL_MESSAGE =
  "Rehearsal: this database change fails on purpose and changes nothing";

/**
 * The rehearsal of a failing deployment: applies the one change kept in the
 * rehearsal folder, which fails on purpose, through the same tool, lock,
 * transaction and record as a real change. It always throws.
 *
 * The order check is off for this one call because the rehearsal folder does
 * not hold the real files already recorded. Should the change ever not fail
 * (someone edited its file), its record is taken out again, so that it can
 * never stand in the table of applied changes, and this still throws.
 */
export async function applyFailingChange(
  client: ClientBase,
  rehearsalDir: string,
  log: (message: string) => void,
): Promise<never> {
  const applied = await runner({
    dbClient: client,
    dir: rehearsalDir,
    direction: "up",
    migrationsTable: MIGRATIONS_TABLE,
    singleTransaction: false,
    checkOrder: false,
    noLock: false,
    log,
  });
  const names = applied.map((migration) => migration.name);
  await client.query("DELETE FROM pgmigrations WHERE name = ANY($1::text[])", [
    names,
  ]);
  throw new Error(
    `The rehearsal's failing change did not fail (${names.join(", ") || "no file was found"}). Nothing of it is recorded as applied; correct the file in db-migrate/rehearsal/`,
  );
}
