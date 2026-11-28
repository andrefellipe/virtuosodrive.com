import { percentile } from "./percentile.ts";

/**
 * The four gates of browsing (pipeline design of Unit U3, stage 7). Each is
 * run against the deployed test environment, through its public address,
 * after the end-to-end tests; each fails the run, and so blocks production.
 *
 *   unchanged    a folder asked for again with the version received answers
 *                "unchanged": the edge passes the caller's version in, and
 *                the version header out;
 *   compressed   the 500-item sample folder, asked for accepting gzip,
 *                arrives compressed and unpacks to the right list: the edge
 *                passes the accepted encodings in, and the entry point and
 *                the edge carry a compressed body out;
 *   speed        100 requests for that folder, 5 a second: the 95th of the
 *                100 durations the server itself reports is at most 500
 *                milliseconds (requirement NFR9.21);
 *   not stored   a folder's answer arrives marked not to be stored, and the
 *                edge says it fetched it from the server and served no kept
 *                copy (security design S28).
 *
 * The sample folders are found by walking from "All" by name, never by an
 * identifier: identifiers are generated in each environment.
 */

/** The sample folder of 500 items, and what its list must be. */
export const LARGE_SAMPLE_FOLDER = "Five hundred items";
export const LARGE_SAMPLE_COUNT = 500;
export const LARGE_SAMPLE_FIRST_NAME = "Lecture notes 001.pdf";
/** A small sample folder, for the gates that need any folder. */
export const SMALL_SAMPLE_FOLDER = "Twenty items";

export const SPEED_TARGET_MS = 500;
export const SPEED_CALLS = 100;
export const SPEED_WARM_UP_CALLS = 3;
/**
 * 5 requests a second, under the test environment's request limit of 10 a
 * second (infra/environment/test.tfvars). A request the limit refuses is not
 * a measurement; it fails the gate as a fault of the gate, not as slowness.
 */
export const SPEED_PACE_MS = 200;

const REQUEST_LIMIT_MS = 10_000;
const REFUSED_BY_THE_REQUEST_LIMIT = 429;

export interface GateOptions {
  /** The environment's address, with https://. */
  baseUrl: string;
  accessPassword: string;
  fetch: typeof fetch;
  now: () => number;
  wait: (ms: number) => Promise<void>;
}

export interface GateResult {
  ok: boolean;
  /** What the gate found, for the run's log. */
  report: string[];
  /** Why it failed; empty when ok. */
  failures: string[];
}

interface FolderBody {
  folderId: string;
  name: string;
  items: { itemId: string; kind: string; name: string }[];
}

const passed = (...report: string[]): GateResult => ({
  ok: true,
  report,
  failures: [],
});
const failed = (failures: string[], report: string[] = []): GateResult => ({
  ok: false,
  report,
  failures,
});

function askFolder(
  options: GateOptions,
  folderId: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return options.fetch(
    new URL(`/v1/folders/${encodeURIComponent(folderId)}`, options.baseUrl),
    {
      method: "GET",
      redirect: "error",
      headers: { Cookie: `vd_access=${options.accessPassword}`, ...headers },
      signal: AbortSignal.timeout(REQUEST_LIMIT_MS),
    },
  );
}

async function folderBody(response: Response): Promise<FolderBody> {
  const body = (await response.json()) as Partial<FolderBody>;
  if (typeof body.folderId !== "string" || !Array.isArray(body.items)) {
    throw new Error("the answer is not a folder");
  }
  return body as FolderBody;
}

/** The identifier of a sample folder directly inside "All", found by its name. */
export async function findSampleFolder(
  options: GateOptions,
  name: string,
): Promise<string> {
  const response = await askFolder(options, "root");
  if (response.status !== 200) {
    throw new Error(`the top folder answered ${response.status}, expected 200`);
  }
  const top = await folderBody(response);
  const found = top.items.find(
    (item) => item.kind === "folder" && item.name === name,
  );
  if (found === undefined) {
    throw new Error(
      `"All" holds no folder named "${name}": is the sample content loaded?`,
    );
  }
  return found.itemId;
}

async function guarded(gate: () => Promise<GateResult>): Promise<GateResult> {
  try {
    return await gate();
  } catch (error) {
    return failed([
      `the gate could not be run: ${error instanceof Error ? error.message : "unknown error"}`,
    ]);
  }
}

/** Unchanged through the whole path. */
export function gateUnchanged(options: GateOptions): Promise<GateResult> {
  return guarded(async () => {
    const folderId = await findSampleFolder(options, SMALL_SAMPLE_FOLDER);
    const first = await askFolder(options, folderId);
    const version = first.headers.get("etag");
    await first.arrayBuffer();
    if (first.status !== 200 || version === null || version === "") {
      return failed([
        first.status === 200
          ? "the folder's answer carried no version: the version header does not come out through the edge"
          : `the folder answered ${first.status}, expected 200`,
      ]);
    }
    const second = await askFolder(options, folderId, {
      "If-None-Match": version,
    });
    const body = await second.arrayBuffer();
    if (second.status !== 304) {
      return failed([
        `asked again with the version received, the folder answered ${second.status}, expected 304: the caller's version does not reach the server through the edge`,
      ]);
    }
    if (body.byteLength !== 0) {
      return failed(['the "unchanged" answer carried content']);
    }
    return passed(
      `"${SMALL_SAMPLE_FOLDER}" answered 200 with a version, then 304 with no content when asked again with it.`,
    );
  });
}

/** Compressed through the whole path. */
export function gateCompressed(options: GateOptions): Promise<GateResult> {
  return guarded(async () => {
    const folderId = await findSampleFolder(options, LARGE_SAMPLE_FOLDER);
    const response = await askFolder(options, folderId, {
      "Accept-Encoding": "gzip",
    });
    if (response.status !== 200) {
      return failed([`the folder answered ${response.status}, expected 200`]);
    }
    // The answer is unpacked by the time it is read here; the header says
    // how it travelled.
    const encoding = response.headers.get("content-encoding");
    const folder = await folderBody(response);
    const failures: string[] = [];
    if (encoding !== "gzip") {
      failures.push(
        `the answer arrived with content encoding "${encoding ?? "none"}", expected gzip: either the accepted encodings do not reach the server, or the compressed answer does not come out`,
      );
    }
    if (folder.items.length !== LARGE_SAMPLE_COUNT) {
      failures.push(
        `the answer unpacked to ${folder.items.length} items, expected ${LARGE_SAMPLE_COUNT}`,
      );
    }
    if (folder.items[0]?.name !== LARGE_SAMPLE_FIRST_NAME) {
      failures.push("the answer did not unpack to the sample folder's list");
    }
    return failures.length > 0
      ? failed(failures)
      : passed(
          `"${LARGE_SAMPLE_FOLDER}" arrived compressed with gzip and unpacked to its ${LARGE_SAMPLE_COUNT} items.`,
        );
  });
}

/** The server's own duration, from the `Server-Timing` header's "app" entry. */
export function serverDurationMs(header: string | null): number | undefined {
  const found = /(?:^|,)\s*app\s*;[^,]*\bdur=([0-9]+(?:\.[0-9]+)?)/.exec(
    header ?? "",
  );
  return found === null ? undefined : Number(found[1]);
}

/** Folder speed. */
export function gateFolderSpeed(options: GateOptions): Promise<GateResult> {
  return guarded(async () => {
    const folderId = await findSampleFolder(options, LARGE_SAMPLE_FOLDER);
    const durations: number[] = [];
    let previousStartedAt: number | undefined;
    for (let made = 0; made < SPEED_WARM_UP_CALLS + SPEED_CALLS; made += 1) {
      if (previousStartedAt !== undefined) {
        // Asked again after each pause: a timer may end a moment early.
        let remainingMs = SPEED_PACE_MS - (options.now() - previousStartedAt);
        while (remainingMs > 0) {
          await options.wait(remainingMs);
          remainingMs = SPEED_PACE_MS - (options.now() - previousStartedAt);
        }
      }
      previousStartedAt = options.now();
      const response = await askFolder(options, folderId, {
        "Accept-Encoding": "gzip",
      });
      await response.arrayBuffer();
      if (response.status === REFUSED_BY_THE_REQUEST_LIMIT) {
        return failed([
          `request ${made + 1} was refused by the environment's request limit (429). That is a fault of this gate or of what else was calling, not slowness: the gate paces itself at ${1000 / SPEED_PACE_MS} requests a second to stay under the limit.`,
        ]);
      }
      if (response.status !== 200) {
        return failed([
          `request ${made + 1} answered ${response.status}, expected 200`,
        ]);
      }
      const duration = serverDurationMs(response.headers.get("server-timing"));
      if (duration === undefined) {
        return failed([
          `request ${made + 1} carried no duration from the server (Server-Timing): the gate cannot measure`,
        ]);
      }
      if (made >= SPEED_WARM_UP_CALLS) {
        durations.push(duration);
      }
    }
    const p95 = percentile(durations, 95);
    const report = [
      `"${LARGE_SAMPLE_FOLDER}", ${durations.length} requests, as the server reports them: middle ${percentile(durations, 50).toFixed(1)} ms, 95th of 100 ${p95.toFixed(1)} ms, slowest ${Math.max(...durations).toFixed(1)} ms. Target: 95th of 100 at most ${SPEED_TARGET_MS} ms.`,
    ];
    return p95 <= SPEED_TARGET_MS
      ? { ok: true, report, failures: [] }
      : failed(["the folder request is over its target"], report);
  });
}

/** Not stored. */
export function gateNotStored(options: GateOptions): Promise<GateResult> {
  return guarded(async () => {
    const folderId = await findSampleFolder(options, SMALL_SAMPLE_FOLDER);
    const failures: string[] = [];
    // Twice: a kept copy would be served at the second request.
    for (const attempt of ["first", "second"]) {
      const response = await askFolder(options, folderId);
      await response.arrayBuffer();
      if (response.status !== 200) {
        return failed([`the folder answered ${response.status}, expected 200`]);
      }
      const cacheControl = response.headers.get("cache-control") ?? "";
      const fromEdge = response.headers.get("x-cache");
      if (!/(^|,)\s*no-store\s*(,|$)/i.test(cacheControl)) {
        failures.push(
          `the ${attempt} answer is not marked "no-store" (Cache-Control: "${cacheControl}")`,
        );
      }
      if (fromEdge === null) {
        failures.push(
          `the ${attempt} answer does not say whether the edge fetched it (no X-Cache header)`,
        );
      } else if (!/^Miss from /i.test(fromEdge)) {
        failures.push(
          `the edge did not fetch the ${attempt} answer from the server (X-Cache: "${fromEdge}")`,
        );
      }
      if (response.headers.get("age") !== null) {
        failures.push(`the ${attempt} answer carries an age: it was kept`);
      }
    }
    return failures.length > 0
      ? failed(failures)
      : passed(
          `"${SMALL_SAMPLE_FOLDER}" arrived twice marked "no-store", each time fetched from the server by the edge.`,
        );
  });
}

export const GATES = {
  unchanged: gateUnchanged,
  compressed: gateCompressed,
  speed: gateFolderSpeed,
  "not-stored": gateNotStored,
} as const;

export type GateName = keyof typeof GATES;
