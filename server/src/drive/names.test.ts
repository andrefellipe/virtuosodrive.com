import { describe, expect, it } from "vitest";
import { NAME_CHARACTERS_UNICODE_VERSION } from "./name-patterns.generated.ts";
import {
  checkNameForm,
  NAME_LIMIT,
  normaliseName,
  numberedName,
  splitName,
  validateName,
} from "./names.ts";
import {
  CONTROL_CHARACTERS,
  codePointName,
  FORMATTING_CHARACTERS,
  LISTED_UNICODE_VERSION,
  WHITE_SPACE_CHARACTERS,
} from "./testing/listed-characters.ts";
import { SAMENESS_CASES, VALIDITY_CASES } from "./testing/name-cases.ts";

const at = (codePoint: number): string => String.fromCodePoint(codePoint);
const EMOJI = at(0x1f600);
const length = (text: string): number => Array.from(text).length;

describe("the name module", () => {
  describe("the name cases of the security requirements", () => {
    it.each(VALIDITY_CASES)("case $row: $what", (testCase) => {
      const result = checkNameForm(testCase.input);

      if ("stored" in testCase.expected) {
        expect(result).toEqual({ ok: true, name: testCase.expected.stored });
      } else {
        expect(result).toEqual({
          ok: false,
          problem: testCase.expected.refused,
        });
      }
    });

    it.each(SAMENESS_CASES)(
      "case $row, what is stored for the second name: $what",
      (testCase) => {
        // Whether the two are the same is the database's to say; the module
        // only makes the form that is stored and compared.
        expect(checkNameForm(testCase.second)).toEqual({
          ok: true,
          name: testCase.secondStored,
        });
        expect(checkNameForm(testCase.first)).toEqual({
          ok: true,
          name: testCase.first,
        });
      },
    );
  });

  describe("normalising", () => {
    it("keeps case, accents, dots and inner spaces exactly as given", () => {
      const name = `  Prova  1 - ${at(0xc9)}tica.v2.PDF `;

      expect(normaliseName(name)).toBe(`Prova  1 - ${at(0xc9)}tica.v2.PDF`);
    });

    it("does nothing to a name already normalised", () => {
      const name = normaliseName(` cafe${at(0x301)} `);

      expect(normaliseName(name)).toBe(name);
      expect(name).toBe(`caf${at(0xe9)}`);
    });
  });

  describe("every listed character", () => {
    it("is generated from the data file's version of the lists", () => {
      expect(NAME_CHARACTERS_UNICODE_VERSION).toBe(LISTED_UNICODE_VERSION);
    });

    it("removes every listed white-space character from both ends", () => {
      const kept: string[] = [];
      for (const character of WHITE_SPACE_CHARACTERS) {
        if (normaliseName(`${character}a${character}`) !== "a") {
          kept.push(codePointName(character));
        }
      }
      expect(WHITE_SPACE_CHARACTERS.length).toBeGreaterThan(20);
      expect(kept).toEqual([]);
    });

    it("refuses every listed formatting character and every control character inside a name", () => {
      const accepted: string[] = [];
      for (const character of [
        ...FORMATTING_CHARACTERS,
        ...CONTROL_CHARACTERS,
        at(0),
      ]) {
        if (validateName(`a${character}b`) !== "nameHasForbiddenCharacter") {
          accepted.push(codePointName(character));
        }
      }
      expect(FORMATTING_CHARACTERS.length).toBeGreaterThan(150);
      expect(accepted).toEqual([]);
    });

    it("reports a name of nothing but listed white space and formatting characters as empty", () => {
      const invisible = [...WHITE_SPACE_CHARACTERS, ...FORMATTING_CHARACTERS];
      for (const character of invisible) {
        expect(checkNameForm(character)).toEqual({
          ok: false,
          problem: "nameEmpty",
        });
      }
      expect(checkNameForm(`${at(0x200b)} ${at(0xfeff)}`)).toEqual({
        ok: false,
        problem: "nameEmpty",
      });
    });
  });

  describe("the order in which failures are reported", () => {
    it("reports empty before anything else", () => {
      expect(checkNameForm("")).toEqual({ ok: false, problem: "nameEmpty" });
      // Longer than the limit, and nothing visible in it: empty comes first.
      expect(validateName(at(0x200b).repeat(NAME_LIMIT + 1))).toBe("nameEmpty");
    });

    it("reports too long before a forbidden character", () => {
      expect(validateName(`${"a".repeat(NAME_LIMIT)}/`)).toBe("nameTooLong");
      expect(validateName(`/${"a".repeat(NAME_LIMIT - 1)}`)).toBe(
        "nameHasForbiddenCharacter",
      );
    });

    it("counts characters as code points, after normalising", () => {
      // 255 letters each sent with a combining accent: 510 before, 255 after.
      const decomposed = `e${at(0x301)}`.repeat(NAME_LIMIT);

      expect(length(decomposed)).toBe(510);
      expect(checkNameForm(decomposed)).toEqual({
        ok: true,
        name: at(0xe9).repeat(NAME_LIMIT),
      });
    });

    it("refuses half of a character pair on its own", () => {
      const half = EMOJI.slice(0, 1);

      expect(validateName(`a${half}b`)).toBe("nameHasForbiddenCharacter");
    });
  });

  describe("the extension rule", () => {
    it.each([
      ["exam.pdf", "exam", ".pdf"],
      ["notes.tar.gz", "notes.tar", ".gz"],
      ["2019.1", "2019.1", ""],
      ["v1.2", "v1.2", ""],
      [".profile", ".profile", ""],
      ["no extension", "no extension", ""],
      ["ends with a dot.", "ends with a dot.", ""],
      ["archive.7z", "archive", ".7z"],
      ["long.abcdefghijk", "long.abcdefghijk", ""],
      ["spaced.p d", "spaced.p d", ""],
      [
        `li${at(0xe7)}${at(0xe3)}o.a${at(0xe7)}${at(0xe3)}o`,
        `li${at(0xe7)}${at(0xe3)}o`,
        `.a${at(0xe7)}${at(0xe3)}o`,
      ],
    ])("splits %s", (name, base, extension) => {
      expect(splitName(name)).toEqual({ base, extension });
    });
  });

  describe("numbered names", () => {
    it("puts the number before the extension, or at the end when there is none", () => {
      expect(numberedName("exam.pdf", 1)).toBe("exam (1).pdf");
      expect(numberedName("notes.tar.gz", 2)).toBe("notes.tar (2).gz");
      expect(numberedName("2019.1", 1)).toBe("2019.1 (1)");
      expect(numberedName(".profile", 12)).toBe(".profile (12)");
    });

    it("shortens the base by whole characters, never the extension, at the 255-character limit", () => {
      const name = `${EMOJI.repeat(NAME_LIMIT - 4)}.pdf`;
      expect(length(name)).toBe(NAME_LIMIT);

      const numbered = numberedName(name, 1);

      expect(length(numbered)).toBe(NAME_LIMIT);
      expect(numbered).toBe(`${EMOJI.repeat(NAME_LIMIT - 8)} (1).pdf`);
      expect(validateName(numbered)).toBeUndefined();
      // A longer number takes one more character from the base.
      expect(numberedName(name, 10)).toBe(
        `${EMOJI.repeat(NAME_LIMIT - 9)} (10).pdf`,
      );
    });

    it("shortens a name with no extension the same way", () => {
      const numbered = numberedName("a".repeat(NAME_LIMIT), 3);

      expect(numbered).toBe(`${"a".repeat(NAME_LIMIT - 4)} (3)`);
    });

    it("refuses a number that is not a whole number from 1", () => {
      expect(() => numberedName("exam.pdf", 0)).toThrow();
      expect(() => numberedName("exam.pdf", 1.5)).toThrow();
    });
  });
});
