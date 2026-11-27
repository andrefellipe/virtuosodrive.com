import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { equalInConstantTime, handleRequest, REFUSAL_POLICY } from "./gate.ts";
import type {
  EdgeEvent,
  EdgeRequest,
  EdgeResponse,
  GateSettings,
} from "./gate.ts";
import { createHandler } from "./handler.ts";
import {
  PAGE_SCRIPT,
  PAGE_SCRIPT_PATH,
  PAGE_STYLE,
  PAGE_STYLE_PATH,
  passwordPageHtml,
} from "./password-page.ts";

// Made up for the tests; not a password of any environment.
const ACCESS_PASSWORD = "Example0Password0For0Tests0Only0";
const sha256 = (text: string, encoding: "hex" | "base64") =>
  createHash("sha256").update(text).digest(encoding);

const settings: GateSettings = {
  enabled: "true",
  accessHash: sha256(ACCESS_PASSWORD, "hex"),
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
      // The same header the edge's own rules send: one year, and every name
      // beneath the site's.
      expect(response.headers["strict-transport-security"]?.value).toBe(
        "max-age=31536000; includeSubDomains",
      );
      expect(response.body.data).toBe(passwordPageHtml());
    }
  });

  it("answers the password page's script and style itself, without a cookie, with their exact content types, and logs nothing", () => {
    const files = [
      [PAGE_SCRIPT_PATH, "text/javascript; charset=utf-8", PAGE_SCRIPT],
      [PAGE_STYLE_PATH, "text/css; charset=utf-8", PAGE_STYLE],
    ] as const;
    for (const [path, contentType, text] of files) {
      // No cookie, a wrong one, the right one: the answer is the same.
      for (const cookie of [undefined, "a-guess", ACCESS_PASSWORD]) {
        const { result, lines } = run(path, cookie);

        expect(isResponse(result)).toBe(true);
        const response = result as EdgeResponse;
        expect(response.statusCode).toBe(200);
        expect(response.statusDescription).toBe("OK");
        expect(response.headers).toEqual({
          "content-type": { value: contentType },
          "cache-control": { value: "no-store" },
          "x-content-type-options": { value: "nosniff" },
        });
        expect(response.body).toEqual({ encoding: "text", data: text });
        expect(lines).toEqual([]);
      }
    }
  });

  it("answers those two paths and no other without the cookie: a path that only resembles one is refused", () => {
    expect(PAGE_SCRIPT_PATH).toBe("/access-password.js");
    expect(PAGE_STYLE_PATH).toBe("/access-password.css");
    for (const uri of [
      `${PAGE_SCRIPT_PATH}.map`,
      `/folder${PAGE_SCRIPT_PATH}`,
      `/v1${PAGE_STYLE_PATH}`,
      PAGE_STYLE_PATH.toUpperCase(),
      `${PAGE_STYLE_PATH}/`,
    ]) {
      const { result, lines } = run(uri);

      expect(isResponse(result) && result.statusCode).toBe(401);
      expect(lines).toHaveLength(1);
    }
  });

  it("holds neither the password nor its fingerprint in the two files or the page", () => {
    for (const text of [PAGE_SCRIPT, PAGE_STYLE, passwordPageHtml()]) {
      expect(text).not.toContain(ACCESS_PASSWORD);
      expect(text).not.toContain(settings.accessHash);
    }
  });

  it("passes the two paths on to the origin like any other file when the flag is off", () => {
    for (const path of [PAGE_SCRIPT_PATH, PAGE_STYLE_PATH]) {
      const { result, lines } = run(path, undefined, { enabled: "false" });

      expect(isResponse(result)).toBe(false);
      expect((result as EdgeRequest).uri).toBe(path);
      expect(lines).toEqual([]);
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
    const script = handler(event(PAGE_SCRIPT_PATH));

    expect(isResponse(malformed) && malformed.statusCode).toBe(401);
    // The built file's placeholders are not filled in here, so nothing matches.
    expect(isResponse(withoutValues) && withoutValues.statusCode).toBe(401);
    expect(isResponse(health)).toBe(false);
    expect(isResponse(script) && script.body.data).toBe(PAGE_SCRIPT);
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe("the password page", () => {
  const html = passwordPageHtml();

  it("is refused with a policy that allows scripts and styles only as files from the site itself", () => {
    const { result } = run("/");
    const policy = (result as EdgeResponse).headers["content-security-policy"]
      ?.value;

    expect(policy).toBe(REFUSAL_POLICY);
    expect(policy).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(policy).not.toMatch(/unsafe|sha256-|nonce-/);
  });

  it("has no script or style written inside it: it refers to the gate's two files, and so works under the edge's policy too", () => {
    expect(html).toContain(`<link rel="stylesheet" href="${PAGE_STYLE_PATH}">`);
    expect(html).toContain(`<script src="${PAGE_SCRIPT_PATH}" defer></script>`);
    // One script element, and it is empty.
    expect(html.match(/<script\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/<script\b[^>]*>[^<]/);
    expect(html).not.toMatch(/<style\b/);
    // No style attribute and no event handler attribute on any element.
    expect(html).not.toMatch(/<[^>]*\sstyle\s*=/i);
    expect(html).not.toMatch(/<[^>]*\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it("cannot put what was typed in the address, or send it, by a plain submission", () => {
    // A form's default method writes its fields into the address as a query.
    expect(html).toContain('<form id="access-form" method="post">');
    expect(html).not.toMatch(/<form\b[^>]*\saction\s*=/);
    // A field without a name is left out of whatever a form sends.
    const field = /<input\b[^>]*>/.exec(html)?.[0] ?? "";
    expect(field).not.toMatch(/\sname\s*=/);
    expect(field).toContain('type="password"');
    expect(field).toContain('autocomplete="current-password"');
    expect(field).toContain('data-testid="access-password-input"');
    expect(html).toContain(
      '<button type="submit" data-testid="access-password-submit">',
    );
  });

  it("is a few kilobytes with one field, and loads nothing from elsewhere", () => {
    expect(html.length).toBeLessThan(4_096);
    expect(html.match(/<input/g)).toHaveLength(1);
    expect(html).toContain('<label for="access-password">');
    expect(html).not.toMatch(/https?:|\/\/|@import|url\(/);
    const referred = [...html.matchAll(/(?:src|href)="([^"]*)"/g)].map(
      (match) => match[1],
    );
    expect(referred.sort()).toEqual([PAGE_STYLE_PATH, PAGE_SCRIPT_PATH].sort());
    expect(PAGE_STYLE).not.toMatch(/https?:|\/\/|@import|url\(/);
    expect(PAGE_SCRIPT).not.toMatch(/https?:|\/\/|import|fetch|XMLHttp/);
  });

  it("stores what was typed in the vd_access cookie for 30 days and opens the same path again, without any query", () => {
    const submitted = (typed: string) => {
      const page = {
        cookie: "",
        opened: [] as string[],
        prevented: 0,
        submit: () => undefined as void,
      };
      const document = {
        getElementById: (id: string) =>
          id === "access-form"
            ? {
                addEventListener: (
                  _: string,
                  listener: (e: object) => void,
                ) => {
                  page.submit = () =>
                    listener({ preventDefault: () => (page.prevented += 1) });
                },
              }
            : { value: typed },
        set cookie(value: string) {
          page.cookie = value;
        },
      };
      // An address that already carries a query, as the old page left it.
      const location = {
        pathname: "/folders/abc",
        search: "?access-password=typed-before",
        replace: (address: string) => page.opened.push(address),
      };
      // The page's one script, run as the browser would run it.
      new Function("document", "location", PAGE_SCRIPT)(document, location);
      page.submit();
      return page;
    };

    const right = submitted(` ${ACCESS_PASSWORD} `);
    expect(right.cookie).toBe(
      `vd_access=${ACCESS_PASSWORD}; Max-Age=2592000; Path=/; Secure; SameSite=Strict`,
    );
    // The plain submission is always stopped; the path is opened once, bare.
    expect(right.prevented).toBe(1);
    expect(right.opened).toEqual(["/folders/abc"]);

    const unusable = submitted("abc; Domain=example.com");
    expect(unusable.cookie).toBe("");
    expect(unusable.prevented).toBe(1);
    expect(unusable.opened).toEqual(["/folders/abc"]);
  });
});
