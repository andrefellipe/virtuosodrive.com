import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readFolder, ROOT } from "./files.ts";
import { findStaleNameCharacters } from "./name-characters.ts";
import { measurePage, PAGE_BUDGET_BYTES } from "./page-size.ts";
import {
  findCommittedDependencies,
  findEmailAddresses,
  findGoogleLibraries,
  findMissingLockFiles,
  findPlainJavaScript,
  findSampleStepProblems,
  findUnpinned,
} from "./repository-rules.ts";
import type { Finding, RepositoryFile } from "./repository-rules.ts";

/**
 * Runs the repository checks over every file Git tracks or would track:
 * no Firebase or Google library, no new plain JavaScript source, no committed
 * dependency folder, no email-shaped text, the page's size limit, pinning,
 * and that the files generated from a data file are up to date.
 *
 * Usage: node scripts/src/repository-checks.ts
 */

export const REQUIRED_LOCK_FILES = [
  "package-lock.json",
  "infra/setup/.terraform.lock.hcl",
  "infra/environment/.terraform.lock.hcl",
];

const TEXT_FILE =
  /\.(ts|tsx|js|mjs|cjs|json|md|ya?ml|html|css|sql|tf|tfvars|hcl|sh|toml|txt)$|(^|\/)\.[\w.-]+$/;

export interface RepositoryReport {
  findings: Finding[];
  filesChecked: number;
  /** Whether a built page was there to be measured. */
  pageMeasured: boolean;
}

function git(root: string, ...args: string[]): string[] {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((line) => line !== "");
}

function checkBuiltPage(folder: string): Finding[] {
  const built = readFolder(folder);
  const findings: Finding[] = [];
  const size = measurePage(built);
  if (!size.withinBudget) {
    findings.push({
      rule: "page-size",
      path: "dist/web",
      detail: `${size.totalCompressedBytes} bytes compressed, at most ${PAGE_BUDGET_BYTES} allowed`,
    });
  }
  // The built files are searched too: a library can arrive inside another.
  findings.push(
    ...findGoogleLibraries(
      built
        .filter((file) => /\.(js|html)$/.test(file.name))
        .map((file) => ({
          path: `dist/web/${file.name}`,
          content: Buffer.from(file.content).toString("utf8"),
        })),
    ),
  );
  return findings;
}

export function checkRepository(root: string = ROOT): RepositoryReport {
  // Tracked files, and files that are new and not ignored; minus those deleted.
  const deleted = new Set(git(root, "ls-files", "--deleted"));
  const tracked = git(root, "ls-files").filter((path) => !deleted.has(path));
  const untracked = git(root, "ls-files", "--others", "--exclude-standard");
  const paths = [...new Set([...tracked, ...untracked])].sort();

  const files: RepositoryFile[] = paths
    .filter((path) => TEXT_FILE.test(path) && existsSync(join(root, path)))
    .map((path) => ({ path, content: readFileSync(join(root, path), "utf8") }));

  const findings: Finding[] = [
    ...findGoogleLibraries(files),
    ...findPlainJavaScript(paths),
    ...findCommittedDependencies(tracked),
    ...findEmailAddresses(files),
    ...findUnpinned(files),
    ...findMissingLockFiles(paths, REQUIRED_LOCK_FILES),
    ...findSampleStepProblems(files),
    // The name rules' character lists: what is generated from the data file
    // must be what is in the repository (security design S23).
    ...findStaleNameCharacters((path) => {
      const full = join(root, path);
      return existsSync(full) ? readFileSync(full, "utf8") : undefined;
    }),
  ];

  const builtPage = join(root, "dist", "web");
  const pageMeasured = existsSync(builtPage);
  if (pageMeasured) {
    findings.push(...checkBuiltPage(builtPage));
  }
  return { findings, filesChecked: paths.length, pageMeasured };
}

if (process.argv[1] === import.meta.filename) {
  const report = checkRepository();
  if (!report.pageMeasured) {
    console.log("The page is not built; its size was not checked here.");
  }
  if (report.findings.length === 0) {
    console.log(`Repository checks passed (${report.filesChecked} files).`);
  } else {
    console.error(
      `Repository checks found ${report.findings.length} problem(s):`,
    );
    for (const finding of report.findings) {
      console.error(`  [${finding.rule}] ${finding.path}: ${finding.detail}`);
    }
    process.exitCode = 1;
  }
}
