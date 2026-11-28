/**
 * The faults that have a name of their own in a log entry (observability
 * design O22). A fault is a known way for a request or a change to fail on
 * the server's side; the entry's `fault` field says which, so that it can be
 * searched for without reading error texts.
 */
export const FAULTS = [
  /** The walk towards the top folder reached its limit without reaching the top. */
  "pathTooDeep",
  /** The response would pass the size limit of what the platform accepts. */
  "answerTooLarge",
  /** A change could not get its folder within the wait allowed. */
  "folderBusy",
  /** The database refused a write for a reason other than a duplicate name. */
  "storeRefused",
] as const;

export type Fault = (typeof FAULTS)[number];
