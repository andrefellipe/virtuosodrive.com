import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Which end-to-end tests of an EARLIER Release are run against the test
 * environment after a newer Release was deployed there: the second half of
 * the compatibility check (reliability design R5; Unit U3's plan, Step 15).
 *
 * The test environment serves the NEW page. So an earlier Release's tests of
 * what its own page shows cannot pass there, and are not run: they would
 * fail for a reason that is no fault. What can be run honestly, and is, are
 * the earlier Release's tests of the server's operations and of the access
 * gate, which ask the environment directly and do not depend on which page
 * is served. Those are what "the earlier Release still works against the
 * new server" can be shown by here.
 *
 *   - A Release marks such tests with the tag below. Then exactly the tagged
 *     tests are run.
 *   - The first Release (Unit U1) was made before the tag existed. For a
 *     Release with no tagged test, the three tests of U1's that are of this
 *     kind are run, by their exact titles.
 *
 * Command line: node scripts/src/earlier-release-tests.ts <folder of the
 * earlier Release's end-to-end tests>. Prints the pattern for Playwright's
 * --grep; fails when it finds nothing to run, because a check that runs
 * nothing proves nothing.
 */

/** The tag of an end-to-end test that must keep passing against any later server. */
export const LATER_SERVER_TAG = "@later-server";

/** U1's tests of the server's operations and the access gate, by title. */
export const FIRST_RELEASE_TITLES: readonly string[] = [
  "a wrong password shows the password page again, with nothing in the address",
  "without the access cookie the page and site information are refused, and health and the password page's two files answer",
  "the entry document is never stored and fingerprinted files are stored for a year",
];

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The pattern for --grep, from the text of the earlier Release's test files.
 * Undefined when those files hold neither a tagged test nor any of the
 * first Release's titles.
 */
export function grepPattern(specs: readonly string[]): string | undefined {
  if (specs.some((spec) => spec.includes(LATER_SERVER_TAG))) {
    return escaped(LATER_SERVER_TAG);
  }
  const present = FIRST_RELEASE_TITLES.filter((title) =>
    specs.some((spec) => spec.includes(title)),
  );
  return present.length === 0
    ? undefined
    : present.map((title) => escaped(title)).join("|");
}

if (process.argv[1] === import.meta.filename) {
  const folder = process.argv[2];
  if (folder === undefined) {
    console.error(
      "Usage: node scripts/src/earlier-release-tests.ts <folder of end-to-end tests>",
    );
    process.exitCode = 2;
  } else {
    const specs = readdirSync(folder)
      .filter((name) => name.endsWith(".spec.ts"))
      .map((name) => readFileSync(join(folder, name), "utf8"));
    const pattern = grepPattern(specs);
    if (pattern === undefined) {
      console.error(
        "The earlier Release has no end-to-end test of the server's operations or the access gate that this check knows. It proved nothing and fails.",
      );
      process.exitCode = 1;
    } else {
      console.log(pattern);
    }
  }
}
