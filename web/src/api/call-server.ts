/**
 * The one function through which the page makes every call to the server
 * (performance design P5, contract C1):
 *
 *   - it gives up on a request after 10 seconds;
 *   - for reads, it tries again after 1 second, and once more after 3 seconds;
 *   - each attempt sends a fresh request identifier;
 *   - a 503 or a 429 is worth another try, whether or not its body is a Problem;
 *   - a 401 that is not a Problem means the access password is needed: the
 *     page is reloaded, which shows the password page, and nothing is retried;
 *   - every other Problem answer is final;
 *   - a caller may pass the version it holds of what it asks for. The server
 *     may then answer "unchanged" (304, no content), which is a third
 *     outcome beside success and failure: never retried, never a failure.
 *     A success hands back the version that came with it (performance
 *     design P23). The browser's own store is not involved: the page keeps
 *     the version itself, and still tells the browser not to store answers.
 *
 * Later Units use the same function; change operations never retry.
 */

export const REQUEST_LIMIT_MS = 10_000;
export const RETRY_PAUSES_MS: readonly number[] = [1_000, 3_000];
export const PROBLEM_CONTENT_TYPE = "application/problem+json";
const REQUEST_ID_HEADER = "X-Request-Id";
const VERSION_HELD_HEADER = "If-None-Match";
const VERSION_HEADER = "ETag";
const UNCHANGED = 304;

export type ReadResult<T> =
  /** `version` is what the server sent with the answer, when it sent one. */
  | { kind: "answered"; data: T; requestId: string; version?: string }
  /** The caller already holds the current version; there is no content. */
  | { kind: "unchanged"; requestId: string }
  | { kind: "failed"; requestId: string; problemCode?: string }
  | { kind: "accessNeeded" };

export interface ReadOptions {
  /** The version the caller holds, exactly as the server sent it. */
  heldVersion?: string;
  /**
   * Request headers of the call's own, sent with every attempt. They cannot
   * replace the ones this function sets.
   */
  headers?: Readonly<Record<string, string>>;
}

export interface CallEnvironment {
  fetch: typeof fetch;
  /** Resolves after the given pause. */
  wait: (ms: number) => Promise<void>;
  /** Reloads the page. */
  reload: () => void;
  newRequestId: () => string;
}

const browser: CallEnvironment = {
  fetch: (input, init) => fetch(input, init),
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  reload: () => window.location.reload(),
  newRequestId: () => crypto.randomUUID(),
};

type Attempt<T> =
  | { next: "done"; result: ReadResult<T> }
  | { next: "retry"; requestId: string };

function isProblem(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").startsWith(
    PROBLEM_CONTENT_TYPE,
  );
}

async function problemCode(response: Response): Promise<string | undefined> {
  if (!isProblem(response)) {
    return undefined;
  }
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "code" in body) {
      const code = (body as { code: unknown }).code;
      return typeof code === "string" ? code : undefined;
    }
  } catch {
    // A Problem whose body cannot be read is still a failure; it just has no code.
  }
  return undefined;
}

async function attempt<T>(
  path: string,
  parse: (body: unknown) => T | undefined,
  environment: CallEnvironment,
  options: ReadOptions,
): Promise<Attempt<T>> {
  const heldVersion = options.heldVersion;
  const sentId = environment.newRequestId();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_LIMIT_MS);
  let response: Response;
  try {
    response = await environment.fetch(path, {
      method: "GET",
      headers: {
        ...options.headers,
        Accept: "application/json",
        [REQUEST_ID_HEADER]: sentId,
        ...(heldVersion === undefined
          ? {}
          : { [VERSION_HELD_HEADER]: heldVersion }),
      },
      cache: "no-store",
      credentials: "same-origin",
      signal: abort.signal,
    });
  } catch {
    // No answer: the network failed, or the 10 seconds passed.
    return { next: "retry", requestId: sentId };
  } finally {
    clearTimeout(timer);
  }

  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? sentId;

  if (response.status === 401 && !isProblem(response)) {
    environment.reload();
    return { next: "done", result: { kind: "accessNeeded" } };
  }
  if (response.status === 503 || response.status === 429) {
    return { next: "retry", requestId };
  }
  if (response.status === UNCHANGED && heldVersion !== undefined) {
    // What the caller holds is current. Not a failure, and nothing to retry.
    return { next: "done", result: { kind: "unchanged", requestId } };
  }
  if (!response.ok) {
    const code = await problemCode(response);
    return {
      next: "done",
      result: {
        kind: "failed",
        requestId,
        ...(code === undefined ? {} : { problemCode: code }),
      },
    };
  }

  let data: T | undefined;
  try {
    data = parse(await response.json());
  } catch {
    data = undefined;
  }
  if (data === undefined) {
    return { next: "done", result: { kind: "failed", requestId } };
  }
  const version = response.headers.get(VERSION_HEADER);
  return {
    next: "done",
    result: {
      kind: "answered",
      data,
      requestId,
      ...(version === null ? {} : { version }),
    },
  };
}

/**
 * Reads from the server. "parse" turns the answer's body into the expected
 * shape, or answers undefined if it is not that shape; unknown fields are
 * ignored. With `heldVersion`, the outcome may be "unchanged". Never rejects.
 */
export async function readFromServer<T>(
  path: string,
  parse: (body: unknown) => T | undefined,
  environment: CallEnvironment = browser,
  options: ReadOptions = {},
): Promise<ReadResult<T>> {
  let lastRequestId = "";
  for (let tries = 0; tries <= RETRY_PAUSES_MS.length; tries += 1) {
    if (tries > 0) {
      await environment.wait(RETRY_PAUSES_MS[tries - 1] as number);
    }
    const outcome = await attempt(path, parse, environment, options);
    if (outcome.next === "done") {
      return outcome.result;
    }
    lastRequestId = outcome.requestId;
  }
  return { kind: "failed", requestId: lastRequestId };
}
