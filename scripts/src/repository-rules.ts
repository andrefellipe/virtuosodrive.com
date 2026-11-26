/**
 * The repository checks (pipeline design, "checks"): things that must never
 * be in the repository, whatever the code does. Each rule is a plain function
 * of file names and contents, so it can be tested; repository-checks.ts reads
 * the files and reports.
 */

export interface RepositoryFile {
  /** Relative to the repository's root, with forward slashes. */
  path: string;
  content: string;
}

export interface Finding {
  rule: string;
  path: string;
  detail: string;
}

/** The old site and AI-DLC's own files are not this work's to check. */
const NOT_NEW =
  /^(app\/|aidlc\/|\.claude\/|README\.md$|vision\.md$|\.mcp\.json$|aidlc\.settings)/;

export function isNewFile(path: string): boolean {
  return !NOT_NEW.test(path);
}

// --- No Firebase or Google library --------------------------------------

const GOOGLE_PACKAGE =
  /^(firebase|firebase-[\w-]+|@firebase\/.+|@google-cloud\/.+|@google\/.+|googleapis|google-auth-library|gcp-metadata)$/;
const GOOGLE_IMPORT =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](firebase|@firebase\/|@google-cloud\/|googleapis)[^"']*["']/;
const GOOGLE_ADDRESS =
  /\b[\w.-]*(firebaseio\.com|firebaseapp\.com|googleapis\.com|gstatic\.com|firebasestorage\.app)\b/;

export function findGoogleLibraries(
  files: readonly RepositoryFile[],
): Finding[] {
  const findings: Finding[] = [];
  for (const file of files.filter((candidate) => isNewFile(candidate.path))) {
    if (file.path.endsWith("package.json")) {
      const manifest = JSON.parse(file.content) as Record<string, unknown>;
      for (const group of [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
        "peerDependencies",
      ]) {
        for (const name of Object.keys(
          (manifest[group] as object | undefined) ?? {},
        )) {
          if (GOOGLE_PACKAGE.test(name)) {
            findings.push({
              rule: "no-google-library",
              path: file.path,
              detail: `depends on ${name}`,
            });
          }
        }
      }
    } else if (
      /\.(ts|tsx|js|mjs|cjs|html)$/.test(file.path) &&
      !/\.test\.tsx?$/.test(file.path) &&
      !file.path.endsWith("repository-rules.ts")
    ) {
      const found =
        GOOGLE_IMPORT.exec(file.content) ?? GOOGLE_ADDRESS.exec(file.content);
      if (found !== null) {
        findings.push({
          rule: "no-google-library",
          path: file.path,
          detail: `refers to ${found[1] ?? found[0]}`,
        });
      }
    }
  }
  return findings;
}

// --- No new plain JavaScript source -------------------------------------

/** Tool configuration files are the one exception the project allows. */
const TOOL_CONFIGURATION = /(^|\/)[\w.-]+\.config\.(js|mjs|cjs)$/;

export function findPlainJavaScript(paths: readonly string[]): Finding[] {
  return paths
    .filter(isNewFile)
    .filter((path) => /\.(js|mjs|cjs|jsx)$/.test(path))
    .filter((path) => !TOOL_CONFIGURATION.test(path))
    .map((path) => ({
      rule: "no-plain-javascript",
      path,
      detail: "new source files are TypeScript",
    }));
}

// --- No committed dependency folder -------------------------------------

export function findCommittedDependencies(paths: readonly string[]): Finding[] {
  const folders = new Set<string>();
  for (const path of paths) {
    const at = `/${path}`.indexOf("/node_modules/");
    if (at !== -1) {
      folders.add(path.slice(0, at + "node_modules".length));
    }
  }
  return [...folders].map((folder) => ({
    rule: "no-committed-dependencies",
    path: folder,
    detail: "installed dependencies are never committed",
  }));
}

// --- No email-shaped text -----------------------------------------------

const EMAIL_SHAPED =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Addresses that are examples by definition, or belong to tools, not people. */
const ALLOWED_ADDRESS =
  /@((?:[\w-]+\.)*example\.(com|org|net)|users\.noreply\.github\.com|noreply\.github\.com)$|^git@github\.com$/;

const NOT_SEARCHED =
  /(^|\/)(package-lock\.json|\.terraform\.lock\.hcl)$|\.(png|ico|pem|ttf|woff2?)$/;

export function findEmailAddresses(
  files: readonly RepositoryFile[],
): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    if (!isNewFile(file.path) || NOT_SEARCHED.test(file.path)) {
      continue;
    }
    for (const found of file.content.match(EMAIL_SHAPED) ?? []) {
      if (!ALLOWED_ADDRESS.test(found)) {
        // The address itself is not repeated in the report.
        findings.push({
          rule: "no-email-address",
          path: file.path,
          detail: "holds email-shaped text",
        });
        break;
      }
    }
  }
  return findings;
}

// --- Pinning --------------------------------------------------------------

const EXACT_VERSION = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
const COMMIT = /^[0-9a-f]{40}$/;

export function findUnpinned(files: readonly RepositoryFile[]): Finding[] {
  const findings: Finding[] = [];
  const add = (path: string, detail: string): void => {
    findings.push({ rule: "pinning", path, detail });
  };
  for (const file of files.filter((candidate) => isNewFile(candidate.path))) {
    if (file.path.endsWith("package.json")) {
      const manifest = JSON.parse(file.content) as Record<string, unknown>;
      for (const group of [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
      ]) {
        for (const [name, version] of Object.entries(
          (manifest[group] as Record<string, string> | undefined) ?? {},
        )) {
          if (!EXACT_VERSION.test(version)) {
            add(file.path, `${name} is "${version}", not an exact version`);
          }
        }
      }
    } else if (/^\.github\/workflows\/.+\.ya?ml$/.test(file.path)) {
      for (const used of file.content.matchAll(
        /^\s*(?:-\s*)?uses:\s*(\S+)/gm,
      )) {
        const reference = used[1] as string;
        const at = reference.lastIndexOf("@");
        if (
          !reference.startsWith("./") &&
          (at === -1 || !COMMIT.test(reference.slice(at + 1)))
        ) {
          add(file.path, `${reference} is not referenced by commit`);
        }
      }
    } else if (/\.tf$/.test(file.path)) {
      for (const constraint of file.content.matchAll(
        /^\s*(required_version|version)\s*=\s*"([^"]*)"/gm,
      )) {
        const value = (constraint[2] as string).replace(/^=\s*/, "");
        if (!EXACT_VERSION.test(value)) {
          add(
            file.path,
            `${constraint[1]} "${constraint[2]}" is not an exact version`,
          );
        }
      }
    }
  }
  return findings;
}

/** A Terraform root configuration must commit the lock file that pins its providers. */
export function findMissingLockFiles(
  paths: readonly string[],
  required: readonly string[],
): Finding[] {
  const present = new Set(paths);
  return required
    .filter((path) => !present.has(path))
    .map((path) => ({
      rule: "pinning",
      path,
      detail: "the lock file is missing",
    }));
}
