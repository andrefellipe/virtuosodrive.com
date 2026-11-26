import type { Database } from "./database.ts";

/** The single record the slice reads (entities: SiteInformation). */
export interface SiteInformation {
  installedAt: Date;
}

const SITE_INFORMATION_ID = 1;

/**
 * Reads the one SiteInformation record. Answers undefined when the record is
 * missing, which means the first database change was not applied.
 */
export async function getSiteInformation(
  database: Database,
): Promise<SiteInformation | undefined> {
  const result = await database.run((connection) =>
    connection.query<{ installed_at: Date }>(
      "SELECT installed_at FROM site_information WHERE id = $1",
      [SITE_INFORMATION_ID],
    ),
  );
  const row = result.rows[0];
  return row === undefined ? undefined : { installedAt: row.installed_at };
}

/** A trivial read, for the health check. Rejects if the database does not answer. */
export async function ping(database: Database): Promise<void> {
  const result = await database.run((connection) =>
    connection.query<{ answer: number }>("SELECT $1::int AS answer", [1]),
  );
  if (result.rows[0]?.answer !== 1) {
    throw new Error(
      "The database answered the health read with something unexpected",
    );
  }
}
