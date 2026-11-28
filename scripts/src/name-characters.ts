import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT } from "./files.ts";
import type { Finding } from "./repository-rules.ts";

/**
 * One list of characters, two users (security design S23). The data file
 * lists the white-space characters and the invisible formatting characters
 * of one Unicode version. From it this script generates
 *
 *   - the server's patterns, which the name module reads; and
 *   - the text of the database's five checks on a name, which the change
 *     file that creates the `items` table repeats word for word.
 *
 * Usage: node scripts/src/name-characters.ts          writes both files, and
 *                                                     puts the checks into
 *                                                     the change file
 *        node scripts/src/name-characters.ts --check  fails if anything is out of date
 *
 * The repository checks run the same comparison on every pull request.
 *
 * Bringing the list to a later Unicode version: edit the data file, run this
 * script, and add a NEW change file that replaces the two generated checks
 * on the table. A change file that has been applied is never edited, so the
 * comparison with `0002_items.sql` is then pointed at the new file.
 */

export const DATA_FILE = "server/src/drive/name-characters.json";
export const PATTERNS_FILE = "server/src/drive/name-patterns.generated.ts";
export const SQL_FILE = "db-migrate/generated/items-name-checks.sql";
/** The change file that must hold the generated checks, word for word. */
export const CHANGE_FILE = "db-migrate/migrations/0002_items.sql";

export const SQL_BLOCK_BEGIN =
  "  -- BEGIN generated name checks (scripts/src/name-characters.ts)";
export const SQL_BLOCK_END = "  -- END generated name checks";

export type CodePointRange = readonly [first: number, last: number];

export interface NameCharacters {
  unicodeVersion: string;
  whiteSpace: CodePointRange[];
  formatting: CodePointRange[];
}

/** Unicode's control characters (category Cc). The set is closed: no version adds to it. */
export const CONTROL_RANGES: readonly CodePointRange[] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
];

const LAST_CODE_POINT = 0x10ffff;

function parseRanges(value: unknown, field: string): CodePointRange[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${DATA_FILE}: "${field}" must be a list of ranges`);
  }
  let previousLast = -1;
  return value.map((item: unknown) => {
    if (
      !Array.isArray(item) ||
      item.length !== 2 ||
      !item.every(
        (end) => typeof end === "string" && /^[0-9A-F]{4,6}$/.test(end),
      )
    ) {
      throw new Error(
        `${DATA_FILE}: every range of "${field}" is two code points in upper-case hexadecimal`,
      );
    }
    const first = Number.parseInt(item[0] as string, 16);
    const last = Number.parseInt(item[1] as string, 16);
    if (first > last || last > LAST_CODE_POINT || first <= previousLast) {
      throw new Error(
        `${DATA_FILE}: the ranges of "${field}" must be in rising order and not overlap`,
      );
    }
    previousLast = last;
    return [first, last] as const;
  });
}

/** Reads the data file's text, refusing anything that is not the expected shape. */
export function parseNameCharacters(text: string): NameCharacters {
  const data = JSON.parse(text) as Record<string, unknown>;
  if (
    typeof data.unicodeVersion !== "string" ||
    !/^\d+\.\d+$/.test(data.unicodeVersion)
  ) {
    throw new Error(`${DATA_FILE}: "unicodeVersion" must be like "18.0"`);
  }
  return {
    unicodeVersion: data.unicodeVersion,
    whiteSpace: parseRanges(data.whiteSpace, "whiteSpace"),
    formatting: parseRanges(data.formatting, "formatting"),
  };
}

const hex = (codePoint: number): string => codePoint.toString(16).toUpperCase();

/** The inside of a JavaScript character class (for a pattern with the "u" flag). */
export function javaScriptClass(ranges: readonly CodePointRange[]): string {
  return ranges
    .map(([first, last]) =>
      first === last
        ? `\\u{${hex(first)}}`
        : `\\u{${hex(first)}}-\\u{${hex(last)}}`,
    )
    .join("");
}

function sqlCodePoint(codePoint: number): string {
  return codePoint > 0xffff
    ? `\\U${hex(codePoint).padStart(8, "0")}`
    : `\\u${hex(codePoint).padStart(4, "0")}`;
}

/**
 * The inside of a bracket expression for PostgreSQL's pattern matching.
 * U+0000 is left out: PostgreSQL's text cannot hold it, and its patterns
 * refuse to name it.
 */
export function sqlClass(ranges: readonly CodePointRange[]): string {
  return ranges
    .map(([first, last]) => [Math.max(first, 1), last] as const)
    .filter(([first, last]) => first <= last)
    .map(([first, last]) =>
      first === last
        ? sqlCodePoint(first)
        : `${sqlCodePoint(first)}-${sqlCodePoint(last)}`,
    )
    .join("");
}

function constant(name: string, value: string): string {
  const oneLine = `export const ${name} = ${JSON.stringify(value)};`;
  // Written as the project's formatter would write it.
  return oneLine.length <= 80
    ? oneLine
    : `export const ${name} =\n  ${JSON.stringify(value)};`;
}

/** The text of the server's generated patterns module. */
export function generatePatterns(data: NameCharacters): string {
  return [
    "// GENERATED by scripts/src/name-characters.ts from name-characters.json.",
    "// Do not edit: change the data file and run the script.",
    "",
    "/** The Unicode version the lists were taken from. */",
    constant("NAME_CHARACTERS_UNICODE_VERSION", data.unicodeVersion),
    "",
    '/** The inside of a character class: every white-space character. For patterns with the "u" flag. */',
    constant("WHITE_SPACE_CLASS", javaScriptClass(data.whiteSpace)),
    "",
    "/** The inside of a character class: every invisible formatting character (category Cf). */",
    constant("FORMATTING_CLASS", javaScriptClass(data.formatting)),
    "",
    "/** The inside of a character class: every control character (category Cc). */",
    constant("CONTROL_CLASS", javaScriptClass(CONTROL_RANGES)),
    "",
  ].join("\n");
}

/** The five checks on a name, as lines of a CREATE TABLE statement. */
export function generateSqlChecks(data: NameCharacters): string {
  const whiteSpace = sqlClass(data.whiteSpace);
  const forbidden = `/${sqlClass(CONTROL_RANGES)}${sqlClass(data.formatting)}`;
  return [
    SQL_BLOCK_BEGIN,
    `  -- Lists taken from Unicode ${data.unicodeVersion}. Do not edit: see the script.`,
    "  CONSTRAINT items_name_composed CHECK (name IS NFC NORMALIZED),",
    "  CONSTRAINT items_name_length CHECK (char_length(name) BETWEEN 1 AND 255),",
    "  CONSTRAINT items_name_not_dots CHECK (name NOT IN ('.', '..')),",
    `  CONSTRAINT items_name_no_forbidden_character CHECK (name !~ '[${forbidden}]'),`,
    `  CONSTRAINT items_name_no_white_space_at_ends CHECK (name !~ '^[${whiteSpace}]' AND name !~ '[${whiteSpace}]$'),`,
    SQL_BLOCK_END,
    "",
  ].join("\n");
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export function generatedFiles(dataText: string): GeneratedFile[] {
  const data = parseNameCharacters(dataText);
  return [
    { path: PATTERNS_FILE, content: generatePatterns(data) },
    { path: SQL_FILE, content: generateSqlChecks(data) },
  ];
}

/**
 * What is out of date: a generated file that differs from what the data file
 * gives, or a change file that does not repeat the generated checks. "read"
 * answers a file's text, or undefined when there is no such file.
 */
export function findStaleNameCharacters(
  read: (path: string) => string | undefined,
): Finding[] {
  const rule = "generated-name-characters";
  const dataText = read(DATA_FILE);
  if (dataText === undefined) {
    return [{ rule, path: DATA_FILE, detail: "the data file is missing" }];
  }
  const findings: Finding[] = [];
  const files = generatedFiles(dataText);
  for (const file of files) {
    if (read(file.path) !== file.content) {
      findings.push({
        rule,
        path: file.path,
        detail:
          "is not what the data file generates; run node scripts/src/name-characters.ts",
      });
    }
  }
  const checks = files.find((file) => file.path === SQL_FILE)?.content ?? "";
  if (!(read(CHANGE_FILE) ?? "").includes(checks.trimEnd())) {
    findings.push({
      rule,
      path: CHANGE_FILE,
      detail: `does not repeat the generated checks of ${SQL_FILE} word for word`,
    });
  }
  return findings;
}

/**
 * The change file's text with the generated checks put between its two
 * marker lines. Answers undefined when the markers are not both there.
 */
export function withGeneratedChecks(
  changeFileText: string,
  checks: string,
): string | undefined {
  const begin = changeFileText.indexOf(SQL_BLOCK_BEGIN);
  const end = changeFileText.indexOf(SQL_BLOCK_END);
  if (begin === -1 || end === -1 || end < begin) {
    return undefined;
  }
  return (
    changeFileText.slice(0, begin) +
    checks.trimEnd() +
    changeFileText.slice(end + SQL_BLOCK_END.length)
  );
}

function readFromRepository(path: string): string | undefined {
  try {
    return readFileSync(join(ROOT, path), "utf8");
  } catch {
    return undefined;
  }
}

if (process.argv[1] === import.meta.filename) {
  if (process.argv[2] === "--check") {
    const findings = findStaleNameCharacters(readFromRepository);
    for (const finding of findings) {
      console.error(`[${finding.rule}] ${finding.path}: ${finding.detail}`);
    }
    process.exitCode = findings.length === 0 ? 0 : 1;
  } else {
    const files = generatedFiles(readFileSync(join(ROOT, DATA_FILE), "utf8"));
    for (const file of files) {
      mkdirSync(dirname(join(ROOT, file.path)), { recursive: true });
      writeFileSync(join(ROOT, file.path), file.content);
      console.log(`wrote ${file.path}`);
    }
    // The change file repeats the checks between two marker lines.
    const checks = files.find((file) => file.path === SQL_FILE)?.content ?? "";
    const changeFile = readFromRepository(CHANGE_FILE);
    const updated =
      changeFile === undefined
        ? undefined
        : withGeneratedChecks(changeFile, checks);
    if (updated === undefined) {
      console.error(
        `${CHANGE_FILE} is missing or has no marker lines; the checks were not put into it`,
      );
      process.exitCode = 1;
    } else {
      writeFileSync(join(ROOT, CHANGE_FILE), updated);
      console.log(`put the checks into ${CHANGE_FILE}`);
    }
  }
}
