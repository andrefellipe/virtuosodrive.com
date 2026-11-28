import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "./files.ts";
import {
  CHANGE_FILE,
  DATA_FILE,
  findStaleNameCharacters,
  generatedFiles,
  generatePatterns,
  generateSqlChecks,
  javaScriptClass,
  parseNameCharacters,
  PATTERNS_FILE,
  SQL_BLOCK_BEGIN,
  SQL_BLOCK_END,
  SQL_FILE,
  sqlClass,
  withGeneratedChecks,
} from "./name-characters.ts";

const DATA = JSON.stringify({
  unicodeVersion: "18.0",
  whiteSpace: [
    ["0009", "000D"],
    ["0020", "0020"],
    ["3000", "3000"],
  ],
  formatting: [
    ["200B", "200F"],
    ["E0001", "E0001"],
  ],
});

const fromRepository = (path: string): string | undefined => {
  try {
    return readFileSync(join(ROOT, path), "utf8");
  } catch {
    return undefined;
  }
};

describe("the generator of the name rules' character lists", () => {
  it("reads the data file's version and ranges", () => {
    expect(parseNameCharacters(DATA)).toEqual({
      unicodeVersion: "18.0",
      whiteSpace: [
        [0x9, 0xd],
        [0x20, 0x20],
        [0x3000, 0x3000],
      ],
      formatting: [
        [0x200b, 0x200f],
        [0xe0001, 0xe0001],
      ],
    });
  });

  it.each([
    ["no version", { unicodeVersion: undefined }],
    ["a version that is not a number", { unicodeVersion: "latest" }],
    ["an empty list", { whiteSpace: [] }],
    ["a range of one end", { whiteSpace: [["0009"]] }],
    ["lower-case hexadecimal", { formatting: [["200b", "200f"]] }],
    ["a range that runs backwards", { formatting: [["200F", "200B"]] }],
    [
      "ranges out of order",
      {
        formatting: [
          ["E0001", "E0001"],
          ["200B", "200F"],
        ],
      },
    ],
    ["a code point beyond Unicode", { formatting: [["110000", "110000"]] }],
  ])("refuses a data file with %s", (_what, change) => {
    const data = { ...(JSON.parse(DATA) as object), ...change };

    expect(() => parseNameCharacters(JSON.stringify(data))).toThrow(DATA_FILE);
  });

  it("writes a character class for JavaScript and one for PostgreSQL, which cannot name U+0000", () => {
    const ranges = [
      [0x0, 0x1f],
      [0xa0, 0xa0],
      [0x1f600, 0x1f602],
    ] as const;

    expect(javaScriptClass(ranges)).toBe(
      "\\u{0}-\\u{1F}\\u{A0}\\u{1F600}-\\u{1F602}",
    );
    expect(sqlClass(ranges)).toBe(
      "\\u0001-\\u001F\\u00A0\\U0001F600-\\U0001F602",
    );
    expect(sqlClass([[0x0, 0x0]])).toBe("");
  });

  it("generates patterns that match exactly the listed characters", () => {
    const source = generatePatterns(parseNameCharacters(DATA));
    const body = /WHITE_SPACE_CLASS =\s+"([^"]+)"/.exec(source)?.[1];
    const whiteSpace = new RegExp(
      `^[${JSON.parse(`"${body ?? ""}"`) as string}]$`,
      "u",
    );

    expect(source).toContain('NAME_CHARACTERS_UNICODE_VERSION = "18.0"');
    expect(whiteSpace.test(" ")).toBe(true);
    expect(whiteSpace.test(String.fromCodePoint(0x3000))).toBe(true);
    expect(whiteSpace.test("a")).toBe(false);
    expect(whiteSpace.test(String.fromCodePoint(0x200b))).toBe(false);
  });

  it("generates the five named checks between the two marker lines", () => {
    const checks = generateSqlChecks(parseNameCharacters(DATA));

    expect(checks.startsWith(SQL_BLOCK_BEGIN)).toBe(true);
    expect(checks.trimEnd().endsWith(SQL_BLOCK_END)).toBe(true);
    expect(checks.match(/CONSTRAINT (items_name_\w+)/g)).toEqual([
      "CONSTRAINT items_name_composed",
      "CONSTRAINT items_name_length",
      "CONSTRAINT items_name_not_dots",
      "CONSTRAINT items_name_no_forbidden_character",
      "CONSTRAINT items_name_no_white_space_at_ends",
    ]);
    expect(checks).toContain("Unicode 18.0");
    expect(checks).toContain(
      "'[/\\u0001-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\U000E0001]'",
    );
  });

  it("puts the checks into a change file between its markers, and says when it has none", () => {
    const checks = generateSqlChecks(parseNameCharacters(DATA));
    // The lines of a change file, as a list: the linter refuses SQL built from pieces.
    const changeFile = [
      "CREATE TABLE items (",
      "  id uuid,",
      SQL_BLOCK_BEGIN,
      "  old text",
      SQL_BLOCK_END,
      "  kind text",
      ");",
      "",
    ].join("\n");

    const updated = withGeneratedChecks(changeFile, checks) ?? "";

    expect(updated).toContain(checks.trimEnd());
    expect(updated).not.toContain("old text");
    expect(updated.startsWith("CREATE TABLE items (\n  id uuid,\n")).toBe(true);
    expect(updated.endsWith("\n  kind text\n);\n")).toBe(true);
    expect(
      withGeneratedChecks("CREATE TABLE items ();", checks),
    ).toBeUndefined();
  });

  describe("the check that nothing generated is out of date", () => {
    const upToDate = (): Map<string, string> => {
      const files = new Map(
        generatedFiles(DATA).map((file) => [file.path, file.content]),
      );
      files.set(DATA_FILE, DATA);
      files.set(
        CHANGE_FILE,
        ["CREATE TABLE items (", files.get(SQL_FILE) ?? "", ");", ""].join(
          "\n",
        ),
      );
      return files;
    };

    it("finds nothing when both generated files and the change file agree with the data file", () => {
      const files = upToDate();

      expect(findStaleNameCharacters((path) => files.get(path))).toEqual([]);
    });

    it("names each file that differs from what the data file generates", () => {
      const files = upToDate();
      files.set(PATTERNS_FILE, `${files.get(PATTERNS_FILE) ?? ""}// edited\n`);
      files.delete(SQL_FILE);

      expect(
        findStaleNameCharacters((path) => files.get(path)).map((finding) => [
          finding.rule,
          finding.path,
        ]),
      ).toEqual([
        ["generated-name-characters", PATTERNS_FILE],
        ["generated-name-characters", SQL_FILE],
      ]);
    });

    it("names the change file when it does not repeat the checks word for word", () => {
      const files = upToDate();
      files.set(
        CHANGE_FILE,
        (files.get(CHANGE_FILE) ?? "").replace("BETWEEN 1 AND 255", "<= 300"),
      );

      expect(findStaleNameCharacters((path) => files.get(path))).toEqual([
        expect.objectContaining({ path: CHANGE_FILE }),
      ]);
    });

    it("reports a missing data file", () => {
      expect(findStaleNameCharacters(() => undefined)).toEqual([
        expect.objectContaining({ path: DATA_FILE }),
      ]);
    });

    it("finds nothing out of date in the repository as it is", () => {
      expect(findStaleNameCharacters(fromRepository)).toEqual([]);
    });
  });
});
