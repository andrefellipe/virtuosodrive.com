import { readFileSync } from "node:fs";
import { pruneListing } from "./releases.ts";

/**
 * Usage: <listing as JSON on standard input> | node scripts/src/prune-releases.ts [protected version ...]
 * Prints the versions of the stored Releases that may be removed, one per line.
 */
export function prune(
  listingJson: string,
  protectedVersions: readonly string[],
  out: (line: string) => void,
  err: (line: string) => void,
): number {
  try {
    for (const version of pruneListing(listingJson, protectedVersions)) {
      out(version);
    }
    return 0;
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] === import.meta.filename) {
  process.exitCode = prune(
    readFileSync(0, "utf8"),
    // "-" is how the pipeline writes "no such Release".
    process.argv.slice(2).filter((version) => version !== "-"),
    console.log,
    console.error,
  );
}
