import { fileURLToPath } from "node:url";

// The SQL files sit one folder above this file, both in the repository
// (db-migrate/src -> db-migrate/migrations) and inside the function's package
// (src/index.mjs -> migrations), so the same relative address works in both.
export const MIGRATIONS_DIR = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

export const CREATE_USERS_FILE = fileURLToPath(
  new URL("../migrations/users/create-users.sql", import.meta.url),
);
