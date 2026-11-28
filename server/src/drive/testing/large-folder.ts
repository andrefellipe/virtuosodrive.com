import type { ClientBase } from "pg";

/** The number of items the design guarantees a folder's answer can carry (scalability design C21). */
export const LARGE_FOLDER_ITEMS = 4_000;

/** A character that takes four bytes; the ten after it stand for the digits 0 to 9. */
const FIRST_FOUR_BYTE_CHARACTER = 0x1f600;

/**
 * Fills a folder with 4,000 files whose names are 255 characters of four
 * bytes each, all different: 251 times the same character, then the item's
 * number written with four more. One statement, for tests only.
 */
export async function fillLargeFolder(
  client: ClientBase,
  folderId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO items (kind, parent_id, name, position, version, size)
     SELECT 'file', $1::uuid,
            repeat(chr($2::int), 251)
              || chr($2::int + n / 1000) || chr($2::int + (n / 100) % 10)
              || chr($2::int + (n / 10) % 10) || chr($2::int + n % 10),
            n, NULL, n
     FROM generate_series(1, $3::int) AS n`,
    [folderId, FIRST_FOUR_BYTE_CHARACTER, LARGE_FOLDER_ITEMS],
  );
}
