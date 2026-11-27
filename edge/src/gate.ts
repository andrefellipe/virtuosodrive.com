import {
  ACCESS_COOKIE,
  PAGE_SCRIPT,
  PAGE_SCRIPT_PATH,
  PAGE_STYLE,
  PAGE_STYLE_PATH,
  passwordPageHtml,
} from "./password-page.ts";

/**
 * The access gate (security design S1): a plain function of an event, run at
 * the edge on every request, in front of both the page's files and the
 * server's operations.
 *
 *   1. The health check is let through.
 *   2. If the gate is switched off for the environment, everything is let through.
 *   3. The password page's script and style, two fixed paths, are answered
 *      by the gate itself, with or without the cookie. They hold nothing
 *      secret, and the password page cannot work without them.
 *   4. A request whose "vd_access" cookie has the stored SHA-256 is let through.
 *   5. Anything else is answered with status 401 and the password page, and
 *      one log line is written with the operation "access refused".
 *
 * For requests that are let through and are not for the server, a path that
 * names no file (no extension) is given the entry document, so the page's own
 * addresses work when opened directly. Paths under /v1 are never rewritten.
 *
 * Written in the plain subset of the language the edge runtime accepts: no
 * classes, destructuring, spread, optional chaining or default parameters.
 */

export interface EdgeValue {
  value: string;
}

export interface EdgeRequest {
  method: string;
  uri: string;
  querystring?: Record<string, unknown>;
  headers: Record<string, EdgeValue>;
  cookies: Record<string, EdgeValue>;
}

export interface EdgeEvent {
  version?: string;
  context?: { requestId?: string; eventType?: string };
  viewer?: { ip?: string };
  request: EdgeRequest;
}

export interface EdgeResponse {
  statusCode: number;
  statusDescription: string;
  headers: Record<string, EdgeValue>;
  body: { encoding: "text"; data: string };
}

export interface GateSettings {
  /** The gate is on unless this is exactly "false". */
  enabled: string;
  /** SHA-256 of the access password, in hexadecimal. The password itself is never here. */
  accessHash: string;
}

export interface GateTools {
  sha256Hex: (text: string) => string;
  log: (line: string) => void;
  now: () => Date;
}

export const HEALTH_PATH = "/v1/health";
export const ENTRY_DOCUMENT = "/index.html";

function isServerPath(uri: string): boolean {
  return uri === "/v1" || uri.indexOf("/v1/") === 0;
}

function namesAFile(uri: string): boolean {
  const lastSegment = uri.substring(uri.lastIndexOf("/") + 1);
  return lastSegment.indexOf(".") !== -1;
}

/** Compares two texts without stopping at the first difference. */
export function equalInConstantTime(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function letThrough(request: EdgeRequest): EdgeRequest {
  if (!isServerPath(request.uri) && !namesAFile(request.uri)) {
    request.uri = ENTRY_DOCUMENT;
  }
  return request;
}

function carriesThePassword(
  request: EdgeRequest,
  settings: GateSettings,
  tools: GateTools,
): boolean {
  const cookie = request.cookies ? request.cookies[ACCESS_COOKIE] : undefined;
  if (!cookie || typeof cookie.value !== "string" || cookie.value === "") {
    return false;
  }
  // An unset or malformed stored hash can never be matched: refuse when in doubt.
  if (!/^[0-9a-f]{64}$/.test(settings.accessHash)) {
    return false;
  }
  return equalInConstantTime(
    tools.sha256Hex(cookie.value),
    settings.accessHash,
  );
}

/**
 * The password page's own policy: its script and style as files from the
 * site itself, and nothing else. The edge's header rule for pages replaces
 * it with the ordinary page's policy, which allows the same two files; the
 * page works under either.
 */
export const REFUSAL_POLICY =
  "default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/**
 * One of the password page's two files. The edge's rules tell the browser
 * not to guess a file's kind, so the content type must be exactly right.
 */
function pageFile(contentType: string, text: string): EdgeResponse {
  return {
    statusCode: 200,
    statusDescription: "OK",
    headers: {
      "content-type": { value: contentType },
      "cache-control": { value: "no-store" },
      "x-content-type-options": { value: "nosniff" },
    },
    body: { encoding: "text", data: text },
  };
}

export function refusal(): EdgeResponse {
  return {
    statusCode: 401,
    statusDescription: "Unauthorized",
    headers: {
      "content-type": { value: "text/html; charset=utf-8" },
      "cache-control": { value: "no-store" },
      "content-security-policy": { value: REFUSAL_POLICY },
      "strict-transport-security": {
        value: "max-age=31536000; includeSubDomains",
      },
      "x-content-type-options": { value: "nosniff" },
      "referrer-policy": { value: "same-origin" },
    },
    body: { encoding: "text", data: passwordPageHtml() },
  };
}

export function handleRequest(
  event: EdgeEvent,
  settings: GateSettings,
  tools: GateTools,
): EdgeRequest | EdgeResponse {
  const request = event.request;

  if (request.uri === HEALTH_PATH) {
    return request;
  }
  if (settings.enabled === "false") {
    return letThrough(request);
  }
  // Before the cookie is looked at, and never logged as a refusal.
  if (request.uri === PAGE_SCRIPT_PATH) {
    return pageFile("text/javascript; charset=utf-8", PAGE_SCRIPT);
  }
  if (request.uri === PAGE_STYLE_PATH) {
    return pageFile("text/css; charset=utf-8", PAGE_STYLE);
  }
  if (carriesThePassword(request, settings, tools)) {
    return letThrough(request);
  }

  // One line per refusal, of the same shape as the server's entries as far
  // as the edge can know them: no query, no cookie, no header.
  tools.log(
    JSON.stringify({
      time: tools.now().toISOString(),
      level: "info",
      operation: "access refused",
      outcome: 401,
      path: request.uri,
      requestId:
        event.context && event.context.requestId
          ? event.context.requestId
          : "unknown",
    }),
  );
  return refusal();
}
