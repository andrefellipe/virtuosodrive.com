import data from "../name-characters.json" with { type: "json" };

/**
 * Every character the data file lists, one by one, for the tests that run
 * each of them through the name module and through the database's checks
 * (security design S23).
 */

function expand(ranges: readonly (readonly string[])[]): string[] {
  const characters: string[] = [];
  for (const [first, last] of ranges) {
    const from = Number.parseInt(first as string, 16);
    const to = Number.parseInt(last as string, 16);
    for (let codePoint = from; codePoint <= to; codePoint += 1) {
      characters.push(String.fromCodePoint(codePoint));
    }
  }
  return characters;
}

export const LISTED_UNICODE_VERSION: string = data.unicodeVersion;

/** Every listed white-space character. */
export const WHITE_SPACE_CHARACTERS: readonly string[] = expand(
  data.whiteSpace,
);

/** Every listed invisible formatting character (category Cf). */
export const FORMATTING_CHARACTERS: readonly string[] = expand(data.formatting);

/**
 * Every control character (category Cc) but U+0000, which neither a
 * PostgreSQL text nor a name sent as JSON text through it can hold.
 */
export const CONTROL_CHARACTERS: readonly string[] = [
  ...expand([["0001", "001F"]]),
  ...expand([["007F", "009F"]]),
];

/** How a character is named in a test's report: never the character itself. */
export function codePointName(character: string): string {
  return `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;
}
