/**
 * The smoke check that ends every Deployment (rules BR3.7): holding the
 * access password, it asks the environment for its health, its site
 * information and its page.
 *
 *   - health answers ok;
 *   - site information answers, in the expected environment and, when a
 *     version is expected, with that version;
 *   - the page loads and, when a version is expected, points at that
 *     Release's files.
 *
 * A just-deployed environment may need a moment, so the whole check is tried
 * a few times before it is reported as failed.
 */

export interface SmokeCheckOptions {
  /** For example https://test.virtuoso.andrefellipelabs.com */
  baseUrl: string;
  accessPassword: string;
  expectedEnvironment: "test" | "production";
  /** Omitted when checking whatever is running (after an infrastructure change). */
  expectedVersion?: string;
  fetch: typeof fetch;
  wait: (ms: number) => Promise<void>;
  attempts?: number;
  pauseMs?: number;
}

export interface SmokeCheckResult {
  ok: boolean;
  /** What was wrong on the last attempt; empty when ok. */
  failures: string[];
  attempts: number;
}

const REQUEST_LIMIT_MS = 10_000;

async function get(
  options: SmokeCheckOptions,
  path: string,
  withPassword: boolean,
): Promise<Response> {
  return options.fetch(new URL(path, options.baseUrl), {
    method: "GET",
    redirect: "error",
    headers: withPassword
      ? { Cookie: `vd_access=${options.accessPassword}` }
      : {},
    signal: AbortSignal.timeout(REQUEST_LIMIT_MS),
  });
}

async function checkHealth(options: SmokeCheckOptions): Promise<string[]> {
  // Asked without the password: the health check is always let through.
  const response = await get(options, "/v1/health", false);
  if (response.status !== 200) {
    return [`health answered ${response.status}, expected 200`];
  }
  const body = (await response.json()) as { status?: unknown };
  return body.status === "ok" ? [] : ['health did not answer { status: "ok" }'];
}

async function checkSiteInformation(
  options: SmokeCheckOptions,
): Promise<string[]> {
  const response = await get(options, "/v1/site-information", true);
  if (response.status !== 200) {
    return [`site information answered ${response.status}, expected 200`];
  }
  const body = (await response.json()) as {
    version?: unknown;
    environment?: unknown;
    installedAt?: unknown;
  };
  const failures: string[] = [];
  if (typeof body.installedAt !== "string") {
    failures.push("site information has no installed time");
  }
  if (body.environment !== options.expectedEnvironment) {
    failures.push(
      `site information is for environment "${String(body.environment)}", expected "${options.expectedEnvironment}"`,
    );
  }
  if (
    options.expectedVersion !== undefined &&
    body.version !== options.expectedVersion
  ) {
    failures.push(
      `the server runs version "${String(body.version)}", expected "${options.expectedVersion}"`,
    );
  }
  return failures;
}

async function checkPage(options: SmokeCheckOptions): Promise<string[]> {
  const response = await get(options, "/", true);
  if (response.status !== 200) {
    return [`the page answered ${response.status}, expected 200`];
  }
  const html = await response.text();
  const failures: string[] = [];
  if (!html.includes("<title>Virtuoso Drive</title>")) {
    failures.push("the page is not the site's entry document");
  }
  if (
    options.expectedVersion !== undefined &&
    !html.includes(`/r/${options.expectedVersion}/`)
  ) {
    failures.push(
      `the page does not point at the files of version "${options.expectedVersion}"`,
    );
  }
  return failures;
}

async function attempt(options: SmokeCheckOptions): Promise<string[]> {
  const failures: string[] = [];
  for (const [name, check] of [
    ["health", checkHealth],
    ["site information", checkSiteInformation],
    ["the page", checkPage],
  ] as const) {
    try {
      failures.push(...(await check(options)));
    } catch (error) {
      failures.push(
        `${name} could not be asked: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
  return failures;
}

export async function runSmokeCheck(
  options: SmokeCheckOptions,
): Promise<SmokeCheckResult> {
  const attempts = options.attempts ?? 5;
  const pauseMs = options.pauseMs ?? 5_000;
  let failures: string[] = [];
  for (let made = 1; made <= attempts; made += 1) {
    failures = await attempt(options);
    if (failures.length === 0) {
      return { ok: true, failures: [], attempts: made };
    }
    if (made < attempts) {
      await options.wait(pauseMs);
    }
  }
  return { ok: false, failures, attempts };
}
