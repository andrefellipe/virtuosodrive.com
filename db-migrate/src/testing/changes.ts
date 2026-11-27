import { readdirSync } from "node:fs";
import { MIGRATIONS_DIR } from "../paths.ts";

/**
 * The names of the database changes in migrations/, in the order they are
 * applied, as the table of applied changes records them (the file's name
 * without ".sql"). Tests read the folder through this, so that none of them
 * assumes how many changes exist: adding a change must not break a test.
 */
export function changeNames(dir: string = MIGRATIONS_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name.slice(0, -".sql".length))
    .sort();
}
