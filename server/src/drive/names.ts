import {
  CONTROL_CLASS,
  FORMATTING_CLASS,
  WHITE_SPACE_CLASS,
} from "./name-patterns.generated.ts";

/**
 * The name rules (rules BR2.4, BR2.5, BR2.7; security design S23): one
 * module turns what a person typed into a name that may be stored, and says
 * why when it cannot. Pure functions; no database.
 *
 * Nothing here decides whether two names are the same. That is the
 * database's alone (decision T26): no code outside it folds case.
 */

export type NameProblem =
  "nameEmpty" | "nameTooLong" | "nameHasForbiddenCharacter";

export type NameResult =
  { ok: true; name: string } | { ok: false; problem: NameProblem };

/** The most characters (Unicode code points) a stored name may have. */
export const NAME_LIMIT = 255;

const WHITE_SPACE_AT_ENDS = new RegExp(
  `^[${WHITE_SPACE_CLASS}]+|[${WHITE_SPACE_CLASS}]+$`,
  "gu",
);
const NOTHING_VISIBLE = new RegExp(
  `^[${WHITE_SPACE_CLASS}${FORMATTING_CLASS}]*$`,
  "u",
);
/**
 * "/", a control character, an invisible formatting character, or half of a
 * character pair on its own (which no stored text can hold).
 */
const FORBIDDEN = new RegExp(
  `[/${CONTROL_CLASS}${FORMATTING_CLASS}\\p{Cs}]`,
  "u",
);
/** 1 to 10 letters or digits, at least one of them a letter. */
const EXTENSION = /^(?=.*\p{L})[\p{L}\p{Nd}]{1,10}$/u;

function codePoints(text: string): string[] {
  return Array.from(text);
}

/**
 * Puts a name in one composed form and removes white space at both ends,
 * and nothing else (rules BR2.4). The result is what is stored, shown and
 * compared. This step cannot fail.
 */
export function normaliseName(text: string): string {
  return text.normalize("NFC").replace(WHITE_SPACE_AT_ENDS, "");
}

/**
 * The first rule a normalised name breaks, in the fixed order of rules
 * BR2.5; undefined when it breaks none.
 */
export function validateName(normalised: string): NameProblem | undefined {
  if (NOTHING_VISIBLE.test(normalised)) {
    return "nameEmpty";
  }
  if (codePoints(normalised).length > NAME_LIMIT) {
    return "nameTooLong";
  }
  if (FORBIDDEN.test(normalised) || normalised === "." || normalised === "..") {
    return "nameHasForbiddenCharacter";
  }
  return undefined;
}

/** Normalises and validates: the name that may be stored, or why not. */
export function checkNameForm(text: string): NameResult {
  const name = normaliseName(text);
  const problem = validateName(name);
  return problem === undefined ? { ok: true, name } : { ok: false, problem };
}

export interface SplitName {
  base: string;
  /** With its dot, or empty when the name has no extension. */
  extension: string;
}

/**
 * Splits a name at its last dot. What follows the dot is an extension only
 * when it is 1 to 10 letters or digits, at least one a letter, and the dot
 * is not the first character: "exam.pdf" and "notes.tar.gz" have one;
 * "2019.1", "v1.2" and ".profile" have none (rules BR2.7).
 */
export function splitName(name: string): SplitName {
  const dot = name.lastIndexOf(".");
  if (dot > 0 && EXTENSION.test(name.slice(dot + 1))) {
    return { base: name.slice(0, dot), extension: name.slice(dot) };
  }
  return { base: name, extension: "" };
}

/**
 * The name with " (n)" before its extension. If that would pass the limit,
 * the base is shortened by whole characters, never the extension.
 */
export function numberedName(name: string, number: number): string {
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(
      `A numbered name needs a whole number from 1, got ${number}`,
    );
  }
  const { base, extension } = splitName(name);
  const suffix = ` (${number})`;
  const room =
    NAME_LIMIT - codePoints(suffix).length - codePoints(extension).length;
  return `${codePoints(base).slice(0, room).join("")}${suffix}${extension}`;
}
