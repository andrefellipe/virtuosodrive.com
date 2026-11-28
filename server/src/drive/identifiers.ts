/**
 * What an identifier of a folder or a file looks like (security design S20,
 * rules BR1.10). One function decides, and it runs before anything reaches a
 * database statement.
 */

/** The identifier that always means the top folder, "All" (rules BR1.2). */
export const ROOT_FOLDER = "root";

/** Exactly the 36-character lower-case form the database generates. */
const GENERATED_FORM =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Whether the text has the form of a generated identifier. Upper case is not that form. */
export function isItemIdentifier(text: unknown): text is string {
  return typeof text === "string" && GENERATED_FORM.test(text);
}

/** Whether the text can name a folder: `root`, or a generated identifier. */
export function isFolderIdentifier(text: unknown): text is string {
  return text === ROOT_FOLDER || isItemIdentifier(text);
}
