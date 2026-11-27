import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildRelease,
  checkVersion,
  EDGE_FUNCTION_LIMIT_BYTES,
} from "./build.ts";
import { runCommand } from "./cli.ts";
import type { CliTools } from "./cli.ts";
import { answerCommand } from "./deployment-record.ts";
import { readFolder, ROOT } from "./files.ts";
import { prune } from "./prune-releases.ts";
import { checkRepository, REQUIRED_LOCK_FILES } from "./repository-checks.ts";

// Made up for the tests; not a password of any environment.
const PASSWORD = "Example0Password0For0Tests0Only0";

describe("the build of a Release", () => {
  // Built into its own folder, so a Release built by hand in dist/ is left alone.
  const out = join(ROOT, "dist", "test-build");
  const lines: string[] = [];

  beforeAll(async () => {
    await buildRelease("t3st123", out, (line) => lines.push(line));
  }, 120_000);

  afterAll(() => {
    rmSync(out, { recursive: true, force: true });
  });

  it("builds the page with its fingerprinted files under the Release's own folder, within the size budget", () => {
    const html = readFileSync(join(out, "web", "index.html"), "utf8");

    expect(html).toContain("<title>Virtuoso Drive</title>");
    expect(html).toContain("needs JavaScript");
    expect(html).toMatch(/src="\/r\/t3st123\/assets\/index-[\w-]+\.js"/);
    expect(html).toMatch(/href="\/r\/t3st123\/assets\/index-[\w-]+\.css"/);
    expect(html).not.toMatch(/https?:\/\//);
    expect(lines.join("\n")).toMatch(/page: \d+ bytes compressed/);
    const names = readFolder(join(out, "web")).map((file) => file.name);
    expect(names.some((name) => /^assets\/af-[\w-]+\.png$/.test(name))).toBe(
      true,
    );
  });

  it("builds the server's package with its version and the database's certificate authorities, and a placeholder that answers 503", async () => {
    expect(
      JSON.parse(readFileSync(join(out, "server", "release.json"), "utf8")),
    ).toEqual({ version: "t3st123" });
    expect(existsSync(join(out, "server", "src", "index.mjs"))).toBe(true);
    expect(
      readFileSync(
        join(out, "server", "certs", "rds-us-east-1-bundle.pem"),
        "utf8",
      ),
    ).toContain("BEGIN CERTIFICATE");

    const placeholder = (await import(
      pathToFileURL(join(out, "placeholder", "src", "index.mjs")).href
    )) as { handler: () => Promise<{ statusCode: number }> };
    expect((await placeholder.handler()).statusCode).toBe(503);
  });

  it("builds the change runner's package with the SQL files beside it, where it looks for them", () => {
    const names = readFolder(join(out, "db-migrate")).map((file) => file.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "src/index.mjs",
        "migrations/0001_site-information.sql",
        "migrations/users/create-users.sql",
        "certs/rds-us-east-1-bundle.pem",
      ]),
    );
  });

  it("builds an access gate that the edge can run: a global handler, within the size limit, with the two values left for Terraform", () => {
    const built = readFileSync(join(out, "edge", "access-gate.js"), "utf8");
    expect(Buffer.byteLength(built)).toBeLessThanOrEqual(
      EDGE_FUNCTION_LIMIT_BYTES,
    );
    expect(built.split("__VD_ACCESS_HASH__")).toHaveLength(2);
    expect(built.split("__VD_GATE_ENABLED__")).toHaveLength(2);
    // Those two are the only values left to fill in.
    expect(built.match(/__VD_[A-Z_]+__/g)).toHaveLength(2);

    // Filled in as Terraform fills it in, then run with only what the edge provides.
    const deployed = built
      .replace(
        "__VD_ACCESS_HASH__",
        createHash("sha256").update(PASSWORD).digest("hex"),
      )
      .replace("__VD_GATE_ENABLED__", "true");
    const logged: string[] = [];
    const edge = vm.createContext({
      require: (name: string) => {
        if (name !== "crypto") {
          throw new Error(`The edge has no module "${name}"`);
        }
        return { createHash };
      },
      console: { log: (line: string) => logged.push(line) },
    });
    vm.runInContext(deployed, edge);
    const handler = vm.runInContext("handler", edge) as (event: object) => {
      uri?: string;
      statusCode?: number;
      headers?: Record<string, { value: string }>;
      body?: { data: string };
    };
    const event = (uri: string, cookie?: string) => ({
      context: { requestId: "edge-1" },
      request: {
        method: "GET",
        uri,
        headers: {},
        cookies: cookie === undefined ? {} : { vd_access: { value: cookie } },
      },
    });

    expect(handler(event("/v1/health")).uri).toBe("/v1/health");
    expect(handler(event("/folders/abc", PASSWORD)).uri).toBe("/index.html");
    const refused = handler(event("/", "a-guess"));
    expect(refused.statusCode).toBe(401);
    const policy = refused.headers?.["content-security-policy"]?.value ?? "";
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("style-src 'self'");
    expect(policy).not.toContain("sha256-");

    // The password page refers to two files, and the built gate answers
    // both without the cookie, each with the content type its kind needs.
    const page = refused.body?.data ?? "";
    const scriptPath = /<script src="([^"]+)" defer><\/script>/.exec(page)?.[1];
    const stylePath = /<link rel="stylesheet" href="([^"]+)">/.exec(page)?.[1];
    expect(page).not.toMatch(/<style\b|<script\b[^>]*>[^<]/);
    const script = handler(event(scriptPath ?? "missing"));
    const style = handler(event(stylePath ?? "missing"));
    expect(script.statusCode).toBe(200);
    expect(script.headers?.["content-type"]?.value).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(script.body?.data).toContain("vd_access=");
    expect(style.statusCode).toBe(200);
    expect(style.headers?.["content-type"]?.value).toBe(
      "text/css; charset=utf-8",
    );
    expect(style.body?.data).toContain("font-family");
    // Only the refusal was logged.
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('"operation":"access refused"');
  });

  it("refuses a version that could not be used in an address", () => {
    expect(checkVersion("a1b2c3d")).toBe("a1b2c3d");
    expect(() => checkVersion("../escape")).toThrow(/cannot be used/);
    expect(() => checkVersion("")).toThrow(/cannot be used/);
  });
});

describe("the repository checks, on this repository", () => {
  it("find nothing: no Google library, no plain JavaScript source, no committed dependencies, no email address, everything pinned", () => {
    const report = checkRepository();

    expect(report.findings).toEqual([]);
    expect(report.filesChecked).toBeGreaterThan(100);
    expect(REQUIRED_LOCK_FILES).toContain("package-lock.json");
  });
});

describe("the command line of the deployed checks", () => {
  function tools(fetchSite: typeof fetch) {
    const out: string[] = [];
    const err: string[] = [];
    let clock = 0;
    const given: CliTools = {
      fetch: fetchSite,
      wait: () => Promise.resolve(),
      now: () => (clock += 20),
      out: (line) => out.push(line),
      err: (line) => err.push(line),
    };
    return { given, out, err };
  }

  const settings = {
    VD_BASE_URL: "https://test.virtuoso.example.com",
    VD_ACCESS_PASSWORD: PASSWORD,
    VD_ENVIRONMENT: "test",
    VD_EXPECTED_VERSION: "a1b2c3d",
  };

  const healthySite = ((input: URL) => {
    const body =
      input.pathname === "/v1/health"
        ? { status: "ok" }
        : {
            installedAt: "2026-12-01T14:03:22.118Z",
            version: "a1b2c3d",
            environment: "test",
          };
    return Promise.resolve(
      input.pathname.startsWith("/v1/")
        ? new Response(JSON.stringify(body), { status: 200 })
        : new Response(
            '<title>Virtuoso Drive</title><script src="/r/a1b2c3d/assets/index.js"></script>',
          ),
    );
  }) as typeof fetch;

  const brokenSite = (() =>
    Promise.resolve(new Response("{}", { status: 503 }))) as typeof fetch;

  it("smoke: exits 0 and says so when the environment passes", async () => {
    const { given, out, err } = tools(healthySite);

    expect(await runCommand("smoke", settings, given)).toBe(0);
    expect(out).toEqual(["Smoke check passed on attempt 1."]);
    expect(err).toEqual([]);
  });

  it("smoke: exits 1 and lists what failed, never printing the password", async () => {
    const { given, out, err } = tools(brokenSite);

    expect(await runCommand("smoke", settings, given)).toBe(1);
    expect(err[0]).toBe("Smoke check failed after 5 attempts:");
    expect(err).toContain("  - health answered 503, expected 200");
    expect([...out, ...err].join("\n")).not.toContain(PASSWORD);
  });

  it("measure: exits 0 with the figures when within the target, and 1 when every call fails", async () => {
    const passing = tools(healthySite);
    expect(await runCommand("measure", settings, passing.given)).toBe(0);
    expect(passing.out[0]).toMatch(
      /^Site information, 100 calls: middle 20 ms, 95th of 100 20 ms, slowest 20 ms, 0 failed\./,
    );

    const failing = tools(brokenSite);
    expect(await runCommand("measure", settings, failing.given)).toBe(1);
    expect(failing.err).toContain("The measurement is over the target.");
  });

  it("exits 2, naming the reason, for an unknown command or a missing or wrong setting", async () => {
    const unknown = tools(healthySite);
    expect(await runCommand("deploy", settings, unknown.given)).toBe(2);
    expect(unknown.err[0]).toMatch(/^Usage:/);

    const missing = tools(healthySite);
    expect(
      await runCommand(
        "smoke",
        { ...settings, VD_ACCESS_PASSWORD: "" },
        missing.given,
      ),
    ).toBe(2);
    expect(missing.err).toEqual(["VD_ACCESS_PASSWORD is not set"]);

    const wrong = tools(healthySite);
    expect(
      await runCommand(
        "smoke",
        { ...settings, VD_ENVIRONMENT: "staging" },
        wrong.given,
      ),
    ).toBe(2);
    expect(wrong.err).toEqual(["VD_ENVIRONMENT must be test or production"]);
  });
});

describe("the command lines the pipeline pipes listings into", () => {
  const deployments = JSON.stringify([
    {
      sha: "b".repeat(40),
      created_at: "2026-12-02T10:00:00Z",
      payload: { release: "bbbbbbb", lambdaVersion: "4", outcome: "succeeded" },
    },
    {
      sha: "a".repeat(40),
      created_at: "2026-12-01T10:00:00Z",
      payload: { release: "aaaaaaa", lambdaVersion: "", outcome: "succeeded" },
    },
  ]);

  it("answer with the running, the previous and the in-reach Releases, one per line", () => {
    expect(answerCommand("running", deployments)).toEqual([
      `bbbbbbb ${"b".repeat(40)} 4`,
    ]);
    expect(answerCommand("previous", deployments)).toEqual([
      `aaaaaaa ${"a".repeat(40)} -`,
    ]);
    expect(answerCommand("in-reach", deployments)).toHaveLength(2);
    expect(answerCommand("previous", "[]")).toEqual([]);
    expect(() => answerCommand("latest", "[]")).toThrow(/^Usage:/);
    expect(() => answerCommand(undefined, "[]")).toThrow(/^Usage:/);
  });

  it("print the Releases to remove, and report a listing that cannot be read", () => {
    const stored = JSON.stringify(
      Array.from({ length: 12 }, (_, index) => ({
        version: `v${index + 1}`,
        storedAt: `2026-12-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
      })),
    );
    const out: string[] = [];
    const err: string[] = [];

    expect(
      prune(
        stored,
        ["v1"],
        (line) => out.push(line),
        (line) => err.push(line),
      ),
    ).toBe(0);
    expect(out).toEqual(["v2"]);
    expect(
      prune(
        "not json",
        [],
        (line) => out.push(line),
        (line) => err.push(line),
      ),
    ).toBe(1);
    expect(err).toHaveLength(1);
  });
});
