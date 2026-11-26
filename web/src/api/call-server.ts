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
 *   - every other Problem answer is final.
 *
 * Later Units use the same function; change operations never retry.
 */

export const REQUEST_LIMIT_MS = 10_000;
export const RETRY_PAUSES_MS: readonly number[] = [1_000, 3_000];
export const PROBLEM_CONTENT_TYPE = "application/problem+json";
const REQUEST_ID_HEADER = "X-Request-Id";

export type ReadResult<T> =
  | { kind: "answered"; data: T; requestId: string }
  | { kind: "failed"; requestId: string; problemCode?: string }
  | { kind: "accessNeeded" };

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
): Promise<Attempt<T>> {
  const sentId = environment.newRequestId();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_LIMIT_MS);
  let response: Response;
  try {
    response = await environment.fetch(path, {
      method: "GET",
      headers: { Accept: "application/json", [REQUEST_ID_HEADER]: sentId },
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
  return {
    next: "done",
    result:
      data === undefined
        ? { kind: "failed", requestId }
        : { kind: "answered", data, requestId },
  };
}

/**
 * Reads from the server. "parse" turns the answer's body into the expected
 * shape, or answers undefined if it is not that shape; unknown fields are
 * ignored. Never rejects.
 */
export async function readFromServer<T>(
  path: string,
  parse: (body: unknown) => T | undefined,
  environment: CallEnvironment = browser,
): Promise<ReadResult<T>> {
  let lastRequestId = "";
  for (let tries = 0; tries <= RETRY_PAUSES_MS.length; tries += 1) {
    if (tries > 0) {
      await environment.wait(RETRY_PAUSES_MS[tries - 1] as number);
    }
    const outcome = await attempt(path, parse, environment);
    if (outcome.next === "done") {
      return outcome.result;
    }
    lastRequestId = outcome.requestId;
  }
  return { kind: "failed", requestId: lastRequestId };
}
