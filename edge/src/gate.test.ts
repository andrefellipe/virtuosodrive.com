import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { equalInConstantTime, handleRequest } from "./gate.ts";
import type {
  EdgeEvent,
  EdgeRequest,
  EdgeResponse,
  GateSettings,
} from "./gate.ts";
import { createHandler } from "./handler.ts";
import { PAGE_SCRIPT, PAGE_STYLE, passwordPageHtml } from "./password-page.ts";

// Made up for the tests; not a password of any environment.
const ACCESS_PASSWORD = "Example0Password0For0Tests0Only0";
const sha256 = (text: string, encoding: "hex" | "base64") =>
  createHash("sha256").update(text).digest(encoding);

const settings: GateSettings = {
  enabled: "true",
  accessHash: sha256(ACCESS_PASSWORD, "hex"),
  scriptHash: sha256(PAGE_SCRIPT, "base64"),
  styleHash: sha256(PAGE_STYLE, "base64"),
};

/** An event of the shape the edge hands a viewer-request function. */
function event(uri: string, cookie?: string): EdgeEvent {
  return {
    version: "1.0",
    context: { requestId: "edge-request-1", eventType: "viewer-request" },
    viewer: { ip: "192.0.2.1" },
    request: {
      method: "GET",
      uri,
      querystring: { token: { value: "should-never-be-logged" } },
      headers: { host: { value: "test.virtuoso.andrefellipelabs.com" } },
      cookies: cookie === undefined ? {} : { vd_access: { value: cookie } },
    },
  };
}

function run(
  uri: string,
  cookie?: string,
  overrides: Partial<GateSettings> = {},
) {
  const lines: string[] = [];
  const result = handleRequest(
    event(uri, cookie),
    { ...settings, ...overrides },
    {
      sha256Hex: (text) => sha256(text, "hex"),
      log: (line) => lines.push(line),
      now: () => new Date("2026-12-01T14:03:22.118Z"),
    },
  );
  return { result, lines };
}

const isResponse = (
  result: EdgeRequest | EdgeResponse,
): result is EdgeResponse => "statusCode" in result;

describe("the access gate", () => {
  it("lets the health check through without a cookie, untouched", () => {
    const { result, lines } = run("/v1/health");

    expect(isResponse(result)).toBe(false);
    expect((result as EdgeRequest).uri).toBe("/v1/health");
    expect(lines).toEqual([]);
  });

  it("lets a request with the right cookie through", () => {
    const { result, lines } = run("/v1/site-information", ACCESS_PASSWORD);

    expect(isResponse(result)).toBe(false);
    expect((result as EdgeRequest).uri).toBe("/v1/site-information");
    expect(lines).toEqual([]);
  });

  it("answers a request without the cookie with 401 and the password page", () => {
    for (const uri of ["/", "/v1/site-information", "/r/a1b2c3d/assets/a.js"]) {
      const { result } = run(uri);

      expect(isResponse(result)).toBe(true);
      const response = result as EdgeResponse;
      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]?.value).toBe(
        "text/html; charset=utf-8",
      );
      expect(response.headers["cache-control"]?.value).toBe("no-store");
      expect(response.body.data).toBe(passwordPageHtml());
    }
  });

  it("answers a wrong cookie with 401, including one that differs by a single character", () => {
    const almost = `${ACCESS_PASSWORD.slice(0, -1)}1`;
    for (const cookie of ["a-guess", almost, "", settings.accessHash]) {
      const { result } = run("/", cookie);
      expect(isResponse(result) && result.statusCode).toBe(401);
    }
  });

  it("writes one log line per refusal, with the path but no query, cookie or password", () => {
    const { lines } = run("/v1/site-information", "a-guess");

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] as string)).toEqual({
      time: "2026-12-01T14:03:22.118Z",
      level: "info",
      operation: "access refused",
      outcome: 401,
      path: "/v1/site-information",
      requestId: "edge-request-1",
    });
    expect(lines[0]).not.toContain("a-guess");
    expect(lines[0]).not.toContain("should-never-be-logged");
  });

  it("gives the entry document to page paths that name no file, and leaves files alone", () => {
    const rewritten = (uri: string) =>
      (run(uri, ACCESS_PASSWORD).result as EdgeRequest).uri;

    expect(rewritten("/")).toBe("/index.html");
    expect(rewritten("/folders/abc123")).toBe("/index.html");
    expect(rewritten("/some.folder/abc")).toBe("/index.html");
    expect(rewritten("/index.html")).toBe("/index.html");
    expect(rewritten("/r/a1b2c3d/assets/index-D4f6.js")).toBe(
      "/r/a1b2c3d/assets/index-D4f6.js",
    );
  });

  it("never rewrites paths under /v1", () => {
    for (const uri of ["/v1", "/v1/", "/v1/site-information", "/v1/a/b/c"]) {
      expect((run(uri, ACCESS_PASSWORD).result as EdgeRequest).uri).toBe(uri);
      expect(
        (run(uri, undefined, { enabled: "false" }).result as EdgeRequest).uri,
      ).toBe(uri);
    }
    // A page path that merely starts with the same letters is not the server's.
    expect((run("/v1x", ACCESS_PASSWORD).result as EdgeRequest).uri).toBe(
      "/index.html",
    );
  });

  it("lets everything through when the flag is off, still giving page paths the entry document", () => {
    const off = { enabled: "false" };

    const page = run("/folders/abc", undefined, off);
    const server = run("/v1/site-information", "a-guess", off);

    expect((page.result as EdgeRequest).uri).toBe("/index.html");
    expect(isResponse(server.result)).toBe(false);
    expect([...page.lines, ...server.lines]).toEqual([]);
  });

  it("stays on unless the flag is exactly off, and refuses everything when its hash was never filled in", () => {
    for (const enabled of ["true", "", "FALSE", "__VD_GATE_ENABLED__"]) {
      expect(isResponse(run("/", undefined, { enabled }).result)).toBe(true);
    }
    const unfilled = "__VD_ACCESS_HASH__";
    expect(
      isResponse(run("/", ACCESS_PASSWORD, { accessHash: unfilled }).result),
    ).toBe(true);
    expect(
      isResponse(run("/", unfilled, { accessHash: unfilled }).result),
    ).toBe(true);
    expect(
      isResponse(run("/v1/health", undefined, { accessHash: unfilled }).result),
    ).toBe(false);
  });

  it("compares in constant time: equal only when every character is", () => {
    expect(equalInConstantTime("abc", "abc")).toBe(true);
    expect(equalInConstantTime("abc", "abd")).toBe(false);
    expect(equalInConstantTime("abc", "ab")).toBe(false);
    expect(equalInConstantTime("", "")).toBe(true);
  });

  it("as deployed, refuses when in doubt: an event it cannot read gets the password page", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const handler = createHandler({
      createHash: () => ({
        update: (text) => ({ digest: () => sha256(text, "hex") }),
      }),
    });

    const malformed = handler({} as EdgeEvent);
    const withoutValues = handler(event("/", ACCESS_PASSWORD));
    const health = handler(event("/v1/health"));

    expect(isResponse(malformed) && malformed.statusCode).toBe(401);
    // The built file's placeholders are not filled in here, so nothing matches.
    expect(isResponse(withoutValues) && withoutValues.statusCode).toBe(401);
    expect(isResponse(health)).toBe(false);
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe("the password page", () => {
  const html = passwordPageHtml();

  it("is allowed by its own content security policy and by nothing wider", () => {
    const { result } = run("/");
    const policy = (result as EdgeResponse).headers["content-security-policy"]
      ?.value;

    expect(html).toContain(`<script>${PAGE_SCRIPT}</script>`);
    expect(html).toContain(`<style>${PAGE_STYLE}</style>`);
    expect(policy).toBe(
      `default-src 'none'; script-src 'sha256-${sha256(PAGE_SCRIPT, "base64")}'; ` +
        `style-src 'sha256-${sha256(PAGE_STYLE, "base64")}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    );
    expect(html.match(/<script/g)).toHaveLength(1);
  });

  it("is a few kilobytes with one field, and loads nothing from elsewhere", () => {
    expect(html.length).toBeLessThan(4_096);
    expect(html.match(/<input/g)).toHaveLength(1);
    expect(html).toContain('<label for="access-password">');
    expect(html).not.toMatch(/https?:|src=|href=|@import|url\(/);
  });

  it("stores what was typed in the vd_access cookie for 30 days and reloads", () => {
    const submitted = (typed: string) => {
      const page = { cookie: "", reloads: 0, submit: () => undefined as void };
      const document = {
        getElementById: (id: string) =>
          id === "access-form"
            ? {
                addEventListener: (
                  _: string,
                  listener: (e: object) => void,
                ) => {
                  page.submit = () =>
                    listener({ preventDefault: () => undefined });
                },
              }
            : { value: typed },
        set cookie(value: string) {
          page.cookie = value;
        },
      };
      const location = { reload: () => (page.reloads += 1) };
      // The page's one script, run as the browser would run it.
      new Function("document", "location", PAGE_SCRIPT)(document, location);
      page.submit();
      return page;
    };

    const right = submitted(` ${ACCESS_PASSWORD} `);
    expect(right.cookie).toBe(
      `vd_access=${ACCESS_PASSWORD}; Max-Age=2592000; Path=/; Secure; SameSite=Strict`,
    );
    expect(right.reloads).toBe(1);

    const unusable = submitted("abc; Domain=example.com");
    expect(unusable.cookie).toBe("");
    expect(unusable.reloads).toBe(1);
  });
});
