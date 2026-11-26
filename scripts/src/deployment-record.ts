import { readFileSync } from "node:fs";

/**
 * The pipeline's record of what runs where (pipeline design, "Vocabulary"):
 * GitHub's deployments. The pipeline adds one record at the end of every
 * Deployment, under the record name "releases-test" or "releases-production",
 * with this payload:
 *
 *   { release, lambdaVersion, direction, outcome }
 *
 * From the records of one environment this file works out which Release is
 * running there, and which ran immediately before it (functional
 * specification, "Outcomes of a Deployment").
 *
 * Command line (the listing from GitHub's API on standard input):
 *   node scripts/src/deployment-record.ts <running|previous|in-reach>
 * Prints "release sha lambdaVersion" lines; nothing when there is none.
 */

export type Outcome = "succeeded" | "notPutInPlace" | "inPlaceButFailing";

export interface DeploymentRecord {
  release: string;
  /** The commit the Release was built from. */
  sha: string;
  /** The numbered version of the server function that holds this Release. */
  lambdaVersion: string;
  direction: "forward" | "back";
  outcome: Outcome;
  createdAt: string;
}

const OUTCOMES: readonly string[] = [
  "succeeded",
  "notPutInPlace",
  "inPlaceButFailing",
];

function readPayload(payload: unknown): Record<string, unknown> | undefined {
  // GitHub returns the payload as it was sent: an object, or JSON text.
  if (typeof payload === "string") {
    try {
      return readPayload(JSON.parse(payload));
    } catch {
      return undefined;
    }
  }
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : undefined;
}

/** Reads GitHub's listing of deployments. Entries that are not the pipeline's records are left out. Oldest first. */
export function parseDeployments(listingJson: string): DeploymentRecord[] {
  const listing: unknown = JSON.parse(listingJson);
  if (!Array.isArray(listing)) {
    throw new Error("The listing of deployments must be a JSON array");
  }
  const records: DeploymentRecord[] = [];
  for (const item of listing as Record<string, unknown>[]) {
    const payload = readPayload(item.payload);
    if (
      payload === undefined ||
      typeof item.sha !== "string" ||
      typeof item.created_at !== "string" ||
      typeof payload.release !== "string" ||
      typeof payload.outcome !== "string" ||
      !OUTCOMES.includes(payload.outcome)
    ) {
      continue;
    }
    records.push({
      release: payload.release,
      sha: item.sha,
      lambdaVersion: String(payload.lambdaVersion ?? ""),
      direction: payload.direction === "back" ? "back" : "forward",
      outcome: payload.outcome as Outcome,
      createdAt: item.created_at,
    });
  }
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The Deployments that put a Release in place, oldest first. */
function putInPlace(records: readonly DeploymentRecord[]): DeploymentRecord[] {
  return records.filter((record) => record.outcome !== "notPutInPlace");
}

/** The Release of the latest Deployment that succeeded or is in place but failing. */
export function runningRelease(
  records: readonly DeploymentRecord[],
): DeploymentRecord | undefined {
  return putInPlace(records).at(-1);
}

/** The Release that was running immediately before the running one. */
export function previousRelease(
  records: readonly DeploymentRecord[],
): DeploymentRecord | undefined {
  const inPlace = putInPlace(records);
  const running = inPlace.at(-1);
  if (running === undefined) {
    return undefined;
  }
  return inPlace.findLast((record) => record.release !== running.release);
}

/** The running Release and the one going back would restore. */
export function releasesInReach(
  records: readonly DeploymentRecord[],
): DeploymentRecord[] {
  return [runningRelease(records), previousRelease(records)].filter(
    (record): record is DeploymentRecord => record !== undefined,
  );
}

/** The command line's answer: one "release sha lambdaVersion" line per Release. */
export function answerCommand(
  command: string | undefined,
  listingJson: string,
): string[] {
  const records = parseDeployments(listingJson);
  const answers: Record<string, () => (DeploymentRecord | undefined)[]> = {
    running: () => [runningRelease(records)],
    previous: () => [previousRelease(records)],
    "in-reach": () => releasesInReach(records),
  };
  const answer = command === undefined ? undefined : answers[command];
  if (answer === undefined) {
    throw new Error(
      "Usage: node scripts/src/deployment-record.ts <running|previous|in-reach>",
    );
  }
  return answer()
    .filter((record): record is DeploymentRecord => record !== undefined)
    .map(
      (record) =>
        `${record.release} ${record.sha} ${record.lambdaVersion || "-"}`,
    );
}

if (process.argv[1] === import.meta.filename) {
  try {
    for (const line of answerCommand(
      process.argv[2],
      readFileSync(0, "utf8"),
    )) {
      console.log(line);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
