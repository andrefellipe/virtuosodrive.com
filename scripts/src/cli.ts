import { GATES } from "./gates.ts";
import type { GateName } from "./gates.ts";
import { measure } from "./measure.ts";
import { runSmokeCheck } from "./smoke-check.ts";

/**
 * The command line for the pipeline's checks of a deployed environment.
 *
 *   node scripts/src/cli.ts smoke        the smoke check
 *   node scripts/src/cli.ts measure      the 100-call measurement, at most
 *                                        8 calls a second (about 15 seconds)
 *   node scripts/src/cli.ts gate <name>  one gate of browsing: unchanged,
 *                                        compressed, speed or not-stored
 *                                        (test environment, sample content)
 *
 * All read:
 *   VD_BASE_URL          the environment's address, with https://
 *   VD_ACCESS_PASSWORD   its access password (never printed)
 *   VD_ENVIRONMENT       test or production
 *   VD_EXPECTED_VERSION  for smoke: the version that must be running (optional)
 *   VD_HAS_BROWSING      for smoke: "yes" when the Release under check has
 *                        browsing, so that the top folder is asked for too.
 *                        Left out, the folder is not asked for: the check
 *                        may be looking at a Release older than browsing.
 */

export interface CliTools {
  fetch: typeof fetch;
  wait: (ms: number) => Promise<void>;
  now: () => number;
  out: (line: string) => void;
  err: (line: string) => void;
}

type Settings = Record<string, string | undefined>;

function required(settings: Settings, name: string): string {
  const value = settings[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function environmentName(settings: Settings): "test" | "production" {
  const value = required(settings, "VD_ENVIRONMENT");
  if (value !== "test" && value !== "production") {
    throw new Error("VD_ENVIRONMENT must be test or production");
  }
  return value;
}

async function smoke(settings: Settings, tools: CliTools): Promise<boolean> {
  const expectedVersion = settings.VD_EXPECTED_VERSION;
  const result = await runSmokeCheck({
    baseUrl: required(settings, "VD_BASE_URL"),
    accessPassword: required(settings, "VD_ACCESS_PASSWORD"),
    expectedEnvironment: environmentName(settings),
    ...(expectedVersion === undefined || expectedVersion === ""
      ? {}
      : { expectedVersion }),
    hasBrowsing: settings.VD_HAS_BROWSING === "yes",
    fetch: tools.fetch,
    wait: tools.wait,
  });
  if (result.ok) {
    tools.out(`Smoke check passed on attempt ${result.attempts}.`);
  } else {
    tools.err(`Smoke check failed after ${result.attempts} attempts:`);
    for (const failure of result.failures) {
      tools.err(`  - ${failure}`);
    }
  }
  return result.ok;
}

async function measureCalls(
  settings: Settings,
  tools: CliTools,
): Promise<boolean> {
  const result = await measure({
    baseUrl: required(settings, "VD_BASE_URL"),
    accessPassword: required(settings, "VD_ACCESS_PASSWORD"),
    fetch: tools.fetch,
    now: tools.now,
    wait: tools.wait,
  });
  tools.out(
    `Site information, ${result.calls} calls: middle ${Math.round(result.p50Ms)} ms, ` +
      `95th of 100 ${Math.round(result.p95Ms)} ms, slowest ${Math.round(result.maxMs)} ms, ` +
      `${result.failures} failed. Target: 95th of 100 at most ${result.targetMs} ms.`,
  );
  if (result.refused > 0) {
    tools.err(
      `${result.refused} of the failed calls were answered 429, refused by the environment's request limit. ` +
        "The measurement starts at most 8 calls a second to stay under that limit, " +
        "so either something else was calling at the same time or the limit is lower than the measurement assumes.",
    );
  }
  if (!result.passed) {
    tools.err("The measurement is over the target.");
  }
  return result.passed;
}

async function gate(
  name: string | undefined,
  settings: Settings,
  tools: CliTools,
): Promise<boolean> {
  if (name === undefined || !Object.hasOwn(GATES, name)) {
    throw new Error(
      `Usage: node scripts/src/cli.ts gate <${Object.keys(GATES).join("|")}>`,
    );
  }
  if (environmentName(settings) !== "test") {
    // The gates rest on the sample content, which production never has.
    throw new Error("The gates of browsing run against the test environment");
  }
  const result = await GATES[name as GateName]({
    baseUrl: required(settings, "VD_BASE_URL"),
    accessPassword: required(settings, "VD_ACCESS_PASSWORD"),
    fetch: tools.fetch,
    now: tools.now,
    wait: tools.wait,
  });
  for (const line of result.report) {
    tools.out(line);
  }
  if (result.ok) {
    tools.out(`Gate "${name}" passed.`);
  } else {
    tools.err(`Gate "${name}" failed:`);
    for (const failure of result.failures) {
      tools.err(`  - ${failure}`);
    }
  }
  return result.ok;
}

/** Runs one command; answers the exit code: 0 passed, 1 failed, 2 could not run. */
export async function runCommand(
  command: string | undefined,
  settings: Settings,
  tools: CliTools,
  argument?: string,
): Promise<number> {
  try {
    if (command === "smoke") {
      return (await smoke(settings, tools)) ? 0 : 1;
    }
    if (command === "measure") {
      return (await measureCalls(settings, tools)) ? 0 : 1;
    }
    if (command === "gate") {
      return (await gate(argument, settings, tools)) ? 0 : 1;
    }
    throw new Error("Usage: node scripts/src/cli.ts <smoke|measure|gate>");
  } catch (error) {
    tools.err(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (process.argv[1] === import.meta.filename) {
  process.exitCode = await runCommand(
    process.argv[2],
    process.env,
    {
      fetch,
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => performance.now(),
      out: console.log,
      err: console.error,
    },
    process.argv[3],
  );
}
