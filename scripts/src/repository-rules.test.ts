import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { measurePage, PAGE_BUDGET_BYTES } from "./page-size.ts";
import { pruneListing, releasesToRemove } from "./releases.ts";
import {
  findCommittedDependencies,
  findEmailAddresses,
  findGoogleLibraries,
  findMissingLockFiles,
  findPlainJavaScript,
  findUnpinned,
} from "./repository-rules.ts";

const rules = (findings: { rule: string; path: string }[]) =>
  findings.map((finding) => `${finding.rule} ${finding.path}`);

describe("no Firebase or Google library", () => {
  it("finds one among a package's dependencies and one imported in source", () => {
    const findings = findGoogleLibraries([
      {
        path: "web/package.json",
        content: JSON.stringify({
          dependencies: { react: "19.3.1", firebase: "6.1.0" },
        }),
      },
      {
        path: "server/src/storage.ts",
        content: 'import { Storage } from "@google-cloud/storage";\n',
      },
      {
        path: "web/index.html",
        content:
          '<script src="https://www.gstatic.com/firebasejs/6.1.0/firebase-app.js"></script>',
      },
    ]);

    expect(rules(findings)).toEqual([
      "no-google-library web/package.json",
      "no-google-library server/src/storage.ts",
      "no-google-library web/index.html",
    ]);
  });

  it("passes the project's own dependencies and leaves the old site alone", () => {
    expect(
      findGoogleLibraries([
        {
          path: "server/package.json",
          content: JSON.stringify({
            dependencies: { pg: "8.23.1", zod: "4.6.7" },
          }),
        },
        {
          path: "server/src/index.ts",
          content: 'import { Client } from "pg";\n',
        },
        {
          path: "app/public/js/VirtuosoController.js",
          content:
            'firebase.initializeApp({ databaseURL: "https://x.firebaseio.com" });',
        },
      ]),
    ).toEqual([]);
  });
});

describe("no new plain JavaScript source", () => {
  it("finds JavaScript source outside the old site, and allows tool configuration", () => {
    const findings = findPlainJavaScript([
      "server/src/helper.js",
      "web/src/Widget.jsx",
      "scripts/tool.mjs",
      "eslint.config.js",
      "web/vite.config.ts",
      "server/src/index.ts",
      "app/public/js/index.js",
      "app/app.js",
    ]);

    expect(rules(findings)).toEqual([
      "no-plain-javascript server/src/helper.js",
      "no-plain-javascript web/src/Widget.jsx",
      "no-plain-javascript scripts/tool.mjs",
    ]);
  });
});

describe("no committed dependency folder", () => {
  it("finds each committed node_modules folder once, wherever it is", () => {
    const findings = findCommittedDependencies([
      "app/node_modules/express/index.js",
      "app/node_modules/express/package.json",
      "node_modules/react/index.js",
      "server/src/index.ts",
      "docs/node_modules.md",
    ]);

    expect(rules(findings)).toEqual([
      "no-committed-dependencies app/node_modules",
      "no-committed-dependencies node_modules",
    ]);
  });
});

// Put together here, so that this file itself holds no email-shaped text
// other than example addresses, and passes the check it tests.
const address = (name: string, domain: string): string => `${name}@${domain}`;

describe("no email-shaped text", () => {
  it("finds an address in a new file without repeating it in the report", () => {
    const findings = findEmailAddresses([
      {
        path: "docs/operations.md",
        content: `Ask ${address("someone", "university.edu.br")} for the password.`,
      },
    ]);

    expect(rules(findings)).toEqual(["no-email-address docs/operations.md"]);
    expect(JSON.stringify(findings)).not.toContain("someone");
  });

  it("allows example addresses, package versions and action references, and skips lock files and the old site", () => {
    expect(
      findEmailAddresses([
        {
          path: "server/src/log/scrub.test.ts",
          content: 'scrub("teacher@example.com, a@mail.example.org")',
        },
        {
          path: "package.json",
          content: '"react@19.3.1", "@aws-sdk/client-secrets-manager@3.1178.0"',
        },
        {
          path: ".github/workflows/checks.yml",
          content:
            "uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
        },
        {
          path: "package-lock.json",
          content: address("maintainer", "some-package.dev"),
        },
        {
          path: "app/public/index.html",
          content: address("author", "old-site.dev"),
        },
      ]),
    ).toEqual([]);
  });
});

describe("pinning", () => {
  it("finds a dependency range, an action referenced by tag and a loose Terraform version", () => {
    const findings = findUnpinned([
      {
        path: "web/package.json",
        content: JSON.stringify({
          dependencies: { react: "^19.3.1", bootstrap: "5.3.9" },
          devDependencies: { vite: "latest" },
        }),
      },
      {
        path: ".github/workflows/checks.yml",
        content:
          "steps:\n  - uses: actions/checkout@v7\n  - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1\n",
      },
      {
        path: "infra/environment/versions.tf",
        content:
          'terraform {\n  required_version = ">= 1.17"\n  required_providers {\n    aws = {\n      version = "~> 6.74"\n    }\n  }\n}\n',
      },
    ]);

    expect(findings.map((finding) => finding.detail)).toEqual([
      'react is "^19.3.1", not an exact version',
      'vite is "latest", not an exact version',
      "actions/checkout@v7 is not referenced by commit",
      'required_version ">= 1.17" is not an exact version',
      'version "~> 6.74" is not an exact version',
    ]);
  });

  it("passes exact versions and commits, and reports a missing lock file", () => {
    expect(
      findUnpinned([
        {
          path: "package.json",
          content: JSON.stringify({ devDependencies: { vitest: "5.1.2" } }),
        },
        {
          path: ".github/workflows/deliver.yml",
          content:
            "    uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1\n",
        },
        {
          path: "infra/setup/versions.tf",
          content: 'required_version = "1.17.1"\nversion = "6.74.0"\n',
        },
        {
          path: "app/package.json",
          content: JSON.stringify({ dependencies: { express: "~4.16.1" } }),
        },
      ]),
    ).toEqual([]);
    expect(
      rules(
        findMissingLockFiles(
          ["package-lock.json"],
          ["package-lock.json", "infra/setup/.terraform.lock.hcl"],
        ),
      ),
    ).toEqual(["pinning infra/setup/.terraform.lock.hcl"]);
  });
});

describe("the page's size", () => {
  it("is within the budget of 300 kilobytes compressed for a small page", () => {
    const size = measurePage([
      {
        name: "index.html",
        content: Buffer.from("<title>Virtuoso Drive</title>"),
      },
      {
        name: "assets/index.js",
        content: Buffer.from("console.log(1);".repeat(100)),
      },
    ]);

    expect(PAGE_BUDGET_BYTES).toBe(307_200);
    expect(size.files).toHaveLength(2);
    expect(size.totalCompressedBytes).toBeLessThan(500);
    expect(size.withinBudget).toBe(true);
  });

  it("is over the budget for content that does not compress below it, and an empty build never passes", () => {
    // Bytes that do not repeat cannot be compressed.
    const incompressible = randomBytes(PAGE_BUDGET_BYTES + 1024);

    expect(
      measurePage([{ name: "assets/big.js", content: incompressible }])
        .withinBudget,
    ).toBe(false);
    expect(measurePage([]).withinBudget).toBe(false);
  });
});

describe("which stored Releases may be removed", () => {
  const stored = Array.from({ length: 13 }, (_, index) => ({
    version: `v${index + 1}`,
    storedAt: `2026-12-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
  }));

  it("keeps the ten most recent and removes the older ones", () => {
    expect(releasesToRemove(stored, [])).toEqual(["v3", "v2", "v1"]);
    expect(releasesToRemove(stored.slice(0, 10), [])).toEqual([]);
  });

  it("never removes the running or the previous Release, however old", () => {
    expect(releasesToRemove(stored, ["v1", "v2"])).toEqual(["v3"]);
  });

  it("reads the pipeline's listing, and refuses one it cannot read or a request to keep none", () => {
    expect(pruneListing(JSON.stringify(stored), ["v1"])).toEqual(["v3", "v2"]);
    expect(() => pruneListing("{}", [])).toThrow(/JSON array/);
    expect(() => pruneListing('[{"version":"v1"}]', [])).toThrow(/storedAt/);
    expect(() => releasesToRemove(stored, [], 0)).toThrow(/At least one/);
  });
});
