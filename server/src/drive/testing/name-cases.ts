/**
 * The table "Name cases" of the security requirements (NFR3.24), kept once
 * and used twice: by the tests of the name module, and by the tests that
 * write straight to the `items` table. Every case must give the listed
 * result in both.
 *
 * Characters outside plain ASCII are written by their code points, so that
 * nothing invisible sits in this file.
 */

export type NameProblem =
  "nameEmpty" | "nameTooLong" | "nameHasForbiddenCharacter";

export interface ValidityCase {
  /** The row of the requirements' table. */
  row: number;
  what: string;
  input: string;
  /** What the name module makes of it: the name as stored, or the refusal. */
  expected: { stored: string } | { refused: NameProblem };
}

const at = (codePoint: number): string => String.fromCodePoint(codePoint);

const ZERO_WIDTH_SPACE = at(0x200b);
const RIGHT_TO_LEFT_OVERRIDE = at(0x202e);
const NO_BREAK_SPACE = at(0xa0);
const IDEOGRAPHIC_SPACE = at(0x3000);
const COMBINING_ACUTE = at(0x301);
const E_ACUTE = at(0xe9);
const O_ACUTE = at(0xf3);
const DOTLESS_I = at(0x131);
const SHARP_S = at(0xdf);
const EMOJI = at(0x1f600);

/**
 * For a direct write, "stored as" a trimmed or composed form means that the
 * untrimmed or uncomposed form is refused: only the module rewrites a name.
 * So a direct write of `input` is accepted exactly when the module would
 * store it unchanged.
 */
export function directWriteAccepted(testCase: ValidityCase): boolean {
  return (
    "stored" in testCase.expected && testCase.expected.stored === testCase.input
  );
}

export const VALIDITY_CASES: readonly ValidityCase[] = [
  {
    row: 1,
    what: "e followed by a combining acute accent",
    input: `cafe${COMBINING_ACUTE}.txt`,
    expected: { stored: `caf${E_ACUTE}.txt` },
  },
  {
    row: 6,
    what: "an ordinary space at both ends",
    input: " exam.pdf ",
    expected: { stored: "exam.pdf" },
  },
  {
    row: 6,
    what: "a no-break space at the end",
    input: `exam.pdf${NO_BREAK_SPACE}`,
    expected: { stored: "exam.pdf" },
  },
  {
    row: 6,
    what: "a no-break space at the start",
    input: `${NO_BREAK_SPACE}exam.pdf`,
    expected: { stored: "exam.pdf" },
  },
  {
    row: 6,
    what: "an ideographic space at both ends",
    input: `${IDEOGRAPHIC_SPACE}exam.pdf${IDEOGRAPHIC_SPACE}`,
    expected: { stored: "exam.pdf" },
  },
  {
    row: 7,
    what: "two inner spaces",
    input: "exam  1.pdf",
    expected: { stored: "exam  1.pdf" },
  },
  {
    row: 8,
    what: "nothing but spaces",
    input: "   ",
    expected: { refused: "nameEmpty" },
  },
  {
    row: 8,
    what: "nothing but a zero-width space",
    input: ZERO_WIDTH_SPACE,
    expected: { refused: "nameEmpty" },
  },
  {
    row: 9,
    what: "a zero-width space between two letters",
    input: `a${ZERO_WIDTH_SPACE}b`,
    expected: { refused: "nameHasForbiddenCharacter" },
  },
  {
    row: 9,
    what: "a right-to-left override",
    input: `exam${RIGHT_TO_LEFT_OVERRIDE}fdp.exe`,
    expected: { refused: "nameHasForbiddenCharacter" },
  },
  {
    row: 10,
    what: "a tab inside",
    input: `exam${at(0x9)}1.pdf`,
    expected: { refused: "nameHasForbiddenCharacter" },
  },
  {
    row: 10,
    what: "a line break inside",
    input: `exam${at(0xa)}1.pdf`,
    expected: { refused: "nameHasForbiddenCharacter" },
  },
  {
    row: 11,
    what: "a single dot",
    input: ".",
    expected: { refused: "nameHasForbiddenCharacter" },
  },
  {
    row: 11,
    what: "two dots",
    input: "..",
    expected: { refused: "nameHasForbiddenCharacter" },
  },
  {
    row: 12,
    what: "a slash",
    input: "a/b",
    expected: { refused: "nameHasForbiddenCharacter" },
  },
  {
    row: 13,
    what: "255 characters, each an emoji",
    input: EMOJI.repeat(255),
    expected: { stored: EMOJI.repeat(255) },
  },
  {
    row: 14,
    what: "256 characters",
    input: "a".repeat(256),
    expected: { refused: "nameTooLong" },
  },
  {
    row: 14,
    what: "256 characters, each an emoji",
    input: EMOJI.repeat(256),
    expected: { refused: "nameTooLong" },
  },
  {
    row: 15,
    what: "three dots",
    input: "...",
    expected: { stored: "..." },
  },
  {
    row: 15,
    what: "a name starting with a dot",
    input: ".profile",
    expected: { stored: ".profile" },
  },
  {
    row: 15,
    what: "a name ending in a number after a dot",
    input: "2019.1",
    expected: { stored: "2019.1" },
  },
];

export interface SamenessCase {
  row: number;
  what: string;
  /** Already a visible item of the folder, in its stored form. */
  first: string;
  /** The name then checked, as a person might send it. */
  second: string;
  /** What the name module stores for the second; a direct write uses this. */
  secondStored: string;
  /** Whether the second is refused as already used. */
  same: boolean;
}

export const SAMENESS_CASES: readonly SamenessCase[] = [
  {
    row: 1,
    what: "one character, and a letter with a combining accent",
    first: `${E_ACUTE}.txt`,
    second: `e${COMBINING_ACUTE}.txt`,
    secondStored: `${E_ACUTE}.txt`,
    same: true,
  },
  {
    row: 2,
    what: "upper and lower case",
    first: "Exam.pdf",
    second: "exam.PDF",
    secondStored: "exam.PDF",
    same: true,
  },
  {
    row: 3,
    what: "with and without an accent",
    first: "prova",
    second: `pr${O_ACUTE}va`,
    secondStored: `pr${O_ACUTE}va`,
    same: false,
  },
  {
    row: 4,
    what: "I and dotless i",
    first: "I",
    second: DOTLESS_I,
    secondStored: DOTLESS_I,
    same: false,
  },
  {
    row: 5,
    what: "sharp s and two capital S",
    first: `stra${SHARP_S}e`,
    second: "STRASSE",
    secondStored: "STRASSE",
    same: false,
  },
  {
    row: 6,
    what: "a no-break space at the end",
    first: "exam.pdf",
    second: `exam.pdf${NO_BREAK_SPACE}`,
    secondStored: "exam.pdf",
    same: true,
  },
  {
    row: 6,
    what: "an ideographic space at the start",
    first: "exam.pdf",
    second: `${IDEOGRAPHIC_SPACE}exam.pdf`,
    secondStored: "exam.pdf",
    same: true,
  },
  {
    row: 7,
    what: "one inner space and two",
    first: "exam 1.pdf",
    second: "exam  1.pdf",
    secondStored: "exam  1.pdf",
    same: false,
  },
];
