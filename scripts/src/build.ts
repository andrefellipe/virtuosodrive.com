import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { build as esbuild } from "esbuild";
import type { BuildOptions } from "esbuild";
import { build as viteBuild } from "vite";
import { readFolder, ROOT } from "./files.ts";
import { measurePage, PAGE_BUDGET_BYTES } from "./page-size.ts";

/**
 * Builds one Release into dist/:
 *
 *   dist/web/          the page: the entry document, and its fingerprinted
 *                      files, which are served from /r/<version>/
 *   dist/server/       the server function's package
 *   dist/db-migrate/   the change runner's package, with the SQL files
 *   dist/placeholder/  the code a new environment's functions start with
 *   dist/edge/         the access gate, as the JavaScript the edge requires
 *
 * Usage: node scripts/src/build.ts [version]
 * The version defaults to VD_VERSION, then to the commit's short identifier.
 */

/** The service's limit on the size of an edge function. */
export const EDGE_FUNCTION_LIMIT_BYTES = 10 * 1024;

const source = (...parts: string[]): string => join(ROOT, ...parts);

export function checkVersion(version: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)) {
    throw new Error(`"${version}" cannot be used as a Release's version`);
  }
  return version;
}

/** One file holding only what the function uses, for Node.js 24 on AWS Lambda. */
function functionBundle(entry: string, outfile: string): BuildOptions {
  return {
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    // Some bundled libraries still ask for Node's own modules with require().
    banner: {
      js: 'import { createRequire as __vdCreateRequire } from "node:module"; const require = __vdCreateRequire(import.meta.url);',
    },
    external: ["pg-native", "cloudflare:sockets"],
    legalComments: "none",
    logLevel: "warning",
  };
}

async function buildPage(
  version: string,
  out: string,
  log: (line: string) => void,
): Promise<void> {
  process.env.VD_BASE = `/r/${version}/`;
  await viteBuild({
    root: source("web"),
    configFile: source("web", "vite.config.ts"),
    logLevel: "warn",
    build: { outDir: join(out, "web"), emptyOutDir: true },
  });
  const size = measurePage(readFolder(join(out, "web")));
  log(
    `page: ${size.totalCompressedBytes} bytes compressed (budget ${PAGE_BUDGET_BYTES})`,
  );
  if (!size.withinBudget) {
    throw new Error(
      `The page is over its budget: ${size.totalCompressedBytes} bytes compressed, at most ${PAGE_BUDGET_BYTES} allowed`,
    );
  }
}

async function buildServer(version: string, out: string): Promise<void> {
  await esbuild(
    functionBundle(
      source("server", "src", "index.ts"),
      join(out, "server", "src", "index.mjs"),
    ),
  );
  cpSync(source("server", "certs"), join(out, "server", "certs"), {
    recursive: true,
  });
  writeFileSync(
    join(out, "server", "release.json"),
    `${JSON.stringify({ version })}\n`,
  );
  // The placeholder sits at the same address inside its package as the real
  // code, so one handler setting serves both.
  await esbuild(
    functionBundle(
      source("server", "src", "placeholder.ts"),
      join(out, "placeholder", "src", "index.mjs"),
    ),
  );
}

async function buildChangeRunner(out: string): Promise<void> {
  await esbuild(
    functionBundle(
      source("db-migrate", "src", "index.ts"),
      join(out, "db-migrate", "src", "index.mjs"),
    ),
  );
  cpSync(
    source("db-migrate", "migrations"),
    join(out, "db-migrate", "migrations"),
    { recursive: true },
  );
  // The change runner verifies the database's certificate against the same
  // published authorities as the server.
  cpSync(source("server", "certs"), join(out, "db-migrate", "certs"), {
    recursive: true,
  });
}

async function buildAccessGate(
  out: string,
  log: (line: string) => void,
): Promise<void> {
  const outfile = join(out, "edge", "access-gate.js");
  await esbuild({
    entryPoints: [source("edge", "src", "entry.ts")],
    outfile,
    bundle: true,
    platform: "neutral",
    target: "es2019",
    format: "iife",
    // The edge calls a global function named "handler"; its runtime provides
    // "crypto" through require(). See edge/src/entry.ts.
    banner: { js: "var __vdGate = {};" },
    footer: {
      js: 'function handler(event) { return __vdGate.createHandler(require("crypto"))(event); }',
    },
    legalComments: "none",
    logLevel: "warning",
  });

  const built = readFileSync(outfile, "utf8");
  for (const placeholder of ["__VD_ACCESS_HASH__", "__VD_GATE_ENABLED__"]) {
    if (built.split(placeholder).length !== 2) {
      throw new Error(
        `The access gate must contain ${placeholder} exactly once, for Terraform to fill in`,
      );
    }
  }

  const bytes = Buffer.byteLength(built);
  log(`access gate: ${bytes} bytes (limit ${EDGE_FUNCTION_LIMIT_BYTES})`);
  if (bytes > EDGE_FUNCTION_LIMIT_BYTES) {
    throw new Error(
      `The access gate is ${bytes} bytes; the edge accepts at most ${EDGE_FUNCTION_LIMIT_BYTES}`,
    );
  }
}

/** Builds the Release with the given version into the given folder, replacing what is there. */
export async function buildRelease(
  version: string,
  out: string,
  log: (line: string) => void,
): Promise<void> {
  checkVersion(version);
  log(`Building Release ${version}`);
  if (existsSync(out)) {
    rmSync(out, { recursive: true });
  }
  mkdirSync(out, { recursive: true });
  await buildPage(version, out, log);
  await buildServer(version, out);
  await buildChangeRunner(out);
  await buildAccessGate(out, log);
  writeFileSync(join(out, "release.json"), `${JSON.stringify({ version })}\n`);
  log(`Release ${version} built`);
}

if (process.argv[1] === import.meta.filename) {
  const version =
    process.argv[2] ??
    process.env.VD_VERSION ??
    execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  buildRelease(version, join(ROOT, "dist"), console.log).catch(
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    },
  );
}
