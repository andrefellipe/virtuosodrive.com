# Code Plan: U1, the thin slice

## Summary

- Builds: this round, only Step 15: fixes for the six findings of the infrastructure scan on pull request 12. Steps 1 to 14 (the page, the server call, the database read, the pipeline, Terraform and the one-time setup) are already built, reviewed and committed
- Touches: this round, `infra/modules/edge/main.tf`, `infra/modules/network/main.tf`, the two Terraform test files under `infra/environment/tests/`, and `code-summary.md`. Nothing deployed is touched; nothing is deployed
- Tests: this round, one more Terraform test (the two zones are the ones named) and the existing 189 unit and integration tests and 8 Terraform tests run again; the infrastructure scan itself runs on the pull request

**Reopened on 2026-11-26** at the maintainer's request, after the pull
request's first run of the infrastructure scan failed 6 of 187 checks. The
plan below is as approved on 2026-11-25, with Step 15 added.

## What this plan is built from

- The slice's behaviour, rules and data: `aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/functional-design/functional-spec.md`, `rules.md`, `entities.md`
- Its quality design: `aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/nfr-design/security-design.md`, `performance-design.md`, and the other designs beside them
- Its infrastructure: `aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/infrastructure-design/infrastructure-specification.md`, `monitoring-design.md`, `cicd-pipeline.md`
- Contract C1: `aidlc/spaces/default/intents/261121-aws-migration/inception/contract-design/contract-summary.md`
- The Unit and its stories US9.1 to US9.4: `aidlc/spaces/default/intents/261121-aws-migration/inception/units-generation/unit-of-work.md`
- Requirements FR12.1 to FR12.7: `aidlc/spaces/default/intents/261121-aws-migration/inception/requirements-analysis/requirements.md`
- The maintainer's answers of 2026-11-25 in `code-generation-questions.md`: the budget counts only this project's tagged resources; `aws-migration` becomes the default branch; eight libraries and tools approved; three design points accepted

Where an earlier document and a later one differ, the later one holds. In
particular: the setup makes the notification topic, the budget, the pipeline
identities and the state bucket (not two things); the error-rate email needs
at least 20 requests; repeated wrong access passwords are not counted; the
ceiling is US$60.

## What this plan does not do

- **It deploys nothing.** No AWS resource is created and no GitHub setting is changed while this plan is built. The maintainer runs the one-time setup afterwards; the pipeline does the rest once the pull request is merged.
- **It does not run the end-to-end tests**, which need a deployed environment. They are written here and first run by the pipeline.
- **It leaves the old site alone.** Nothing under `app/public` changes, and nothing is sent to Firebase.

## Layout

One npm workspace at the repository's root, beside the old `app/`.

| Folder | Holds | Language |
|--------|-------|----------|
| `web/` | The page (React, Vite) | TypeScript |
| `server/` | The server function: operations, request steps, database access | TypeScript |
| `db-migrate/` | The change runner function and the SQL files it applies | TypeScript, SQL |
| `edge/` | The access gate and the password page | TypeScript (compiled to the JavaScript the edge requires) |
| `e2e/` | End-to-end tests | TypeScript |
| `scripts/` | Smoke check, the 100-call measurement, repository checks | TypeScript |
| `infra/setup/` | The one-time setup, with its script for GitHub's settings | Terraform, shell |
| `infra/environment/` | One environment, applied twice with `test.tfvars` and `production.tfvars` | Terraform |
| `infra/modules/` | `network`, `database`, `server`, `edge`, `monitoring` | Terraform |
| `.github/workflows/` | `checks`, `deliver`, `go-back`, `compare` | YAML |
| `docs/` | The procedures a person performs; records of rehearsals | Markdown |

## Changes to files that were already here

Each is the maintainer's file and is changed only as listed.

| File | Change | Asked for by |
|------|--------|--------------|
| `app/node_modules/` (345 committed files) | Removed from Git; the folder on disk is not deleted | Project rule; rules BR7.1; the Unit's notes |
| `app/package.json`, `app/package-lock.json` | The unused `formidable` dependency removed | The Unit's notes |
| `.gitignore` (root) | Lines added for `node_modules/`, build output, coverage, Terraform's working folders and local state | Needed so that new build output is never committed |
| `README.md` | Not changed. How to run the new code goes in `docs/` and in this record's code summary | - |

## Steps

Each step names the stories it serves. Tests follow the code of each layer,
as the Testing Contract below requires.

- [x] **Step 1: Project structure and configuration.** (US9.1) Root `package.json` with the workspaces and scripts `check` (format, lint, type check, unit and integration tests with coverage, build, repository checks) and `e2e`; `tsconfig.base.json` with `strict`; ESLint with typescript-eslint, the React plugins, a rule forbidding `dangerouslySetInnerHTML`, and a rule forbidding SQL built from template text; Prettier with defaults; the `.gitignore` additions; removal of `app/node_modules` from Git and of `formidable`; every dependency pinned exactly, with a lockfile.
- [x] **Step 2: Test runner.** (US9.1) Vitest configured once at the root for all workspaces, with line coverage measured over new TypeScript only (`app/`, generated files, configuration files and tests excluded) and a threshold of 80%; Testcontainers for PostgreSQL; one trivial passing test so that the unit-scoped command in `unit-test-instructions.md` runs before any other test exists.
- [x] **Step 3: Data model, implement.** (US9.2) In `db-migrate/migrations/`, the first SQL file creates table `site_information` with columns `id` (small integer, primary key, constrained to the value 1, so that exactly one row can exist: entities, SiteInformation) and `installed_at` (timestamp with time zone, not null, default now: entities, SiteInformation.installedAt), inserts the one row, and grants the user `app` read access to it. The same folder holds the statement that creates the database users `app` (may read and write rows) and `migrator` (owns the structure), both signing in by AWS identity (infrastructure specification, `db-migrate` row). The table `pgmigrations`, in which node-pg-migrate records what has been applied, is created by that tool (reliability design R3).
- [x] **Step 4: Data model, tests.** (US9.2, US9.4) Integration tests against PostgreSQL in a container: the changes apply to an empty database; applying them again changes nothing; a second row in `site_information` is refused; `app` can read the row and cannot alter the table.
- [x] **Step 5: Data access, implement.** (US9.3) In `server/src/db/`: one connection per running copy, opened on first need with a sign-in token made from the function's own identity, TLS with the database's certificate verified, a single 3-second deadline for everything asked of the database in one request, one reopen if the connection is found broken before a statement is sent; `getSiteInformation` and `ping` as parameterised statements.
- [x] **Step 6: Data access, tests.** Integration tests: the row is read; a stopped database fails within 3 seconds and recovers on the next request after it restarts; a broken connection is reopened once; a wrong certificate authority is refused. Unit tests of the deadline arithmetic.
- [x] **Step 7: Request steps and logging, implement.** (US9.3) In `server/src/http/`: the fixed sequence every request passes through (edge secret check with one re-read on mismatch, request identifier, routing from one declared list of operations, validation with Zod, the operation, failures turned into a Problem, one log entry); in `server/src/log/`: the entry's fields, the function that removes anything shaped like an email address, and the four measurements, none for health checks.
- [x] **Step 8: Request steps and logging, tests.** Unit tests: a request without the edge secret is refused with 403 and no body; a malformed request identifier is replaced and not logged; unknown query parameters are refused; an unknown path answers `notFound`; a thrown error becomes `serverError` with nothing internal in it; the log entry has exactly the named fields; email-shaped text is removed, including inside error messages; health checks write no measurements; the list of operations contains only GET.
- [x] **Step 9: Operations, implement.** (US9.2, US9.3) `GET /v1/health` and `GET /v1/site-information` in `server/src/operations/`; the function's entry point; the placeholder that answers 503 before the first deployment; `server/openapi.yaml` describing both operations per contract C1; in `db-migrate/src/`, the runner: sign in as `migrator`, create the users first only when signing in shows they do not exist and the master sign-in confirms it, take the lock, apply pending files, report what was applied.
- [x] **Step 10: Operations, tests.** Integration tests through the function's entry point against PostgreSQL in a container: health answers ok, and 503 as a Problem when the database is stopped; site information answers with the installed time, version and environment, and 500 as a Problem when the row is missing; both carry the request identifier. Unit tests of the runner's decision whether to create users. A test that the OpenAPI file and the declared operations agree.
- [x] **Step 11: Page and access gate, implement.** (US9.2) In `web/`: the entry document with the site's name and a sentence for browsers without JavaScript; one status component with its three views (checking, answered with version and environment, could not reach with a "Try again" button and the request identifier), the status line as a live region, `data-testid` on the button and the status line; the shared function for calls to the server (10-second limit, two further tries for reads after 1 and 3 seconds, a reload on a 401 that is not a Problem); the existing logo and favicon copied from `app/public/images`; only the parts of Bootstrap the page uses. In `edge/`: the access gate (health check let through, cookie compared by SHA-256 in constant time, the password page otherwise, one log line per refusal, paths without a file extension given the entry document on page requests only, an on/off flag) and the password page, a few kilobytes with one field and one script.
- [x] **Step 12: Page and access gate, tests.** Unit tests with React Testing Library: each of the three views; the retry sequence and its timing; a 429 and a 503 retried, another Problem not; the reload on a non-Problem 401; the request identifier shown on failure. Unit tests of the gate: health passes without a cookie; a right cookie passes; a wrong or missing one gets the password page with 401; `/v1` paths are never rewritten; the flag off lets everything through.
- [x] **Step 13: Infrastructure, pipeline and end-to-end tests.** (US9.1, US9.2, US9.3, US9.4) Terraform in `infra/` exactly as the infrastructure specification and monitoring design list, with every resource named for its environment and tagged `project`, `environment`, `unit`; the budget counting only resources tagged `project = virtuoso-drive` (answer Q1); `infra/setup/` with its script that moves its own state into the bucket and its script for GitHub's settings (branch protection, the `production` environment, the default branch); Checkov's configuration with each exception recorded with its reason; Gitleaks' configuration; the four workflows of the pipeline design, every action referenced by commit; `scripts/` for the smoke check, the 100-call measurement, and the repository checks (no Firebase or Google library, no new plain JavaScript source, no committed dependency folder, no email-shaped text, the page's size limit, pinning); two `terraform test` files checking, without touching AWS, that names carry the environment's prefix and that alarms and the health check exist only when the `alarms` variable is on. In `e2e/`, six Playwright tests, run in three browser engines at two widths: the page shows the answered view with version and environment; the could-not-reach view and "Try again" by keyboard when the server is blocked; the accessibility scan of each view and of the password page; no request to any address but the site's own; without the access cookie the page and site information are refused and health answers; the entry document is never stored and fingerprinted files are stored for a year.
- [x] **Step 14: Documentation and traceability.** (US9.2, US9.4) `docs/operations.md` with the procedures a person performs (run the setup, approve production, go back, restore the database, replace the access password, read the logs for a request, what to do for each alarm email, how to prove the alarms); `docs/records/` with an empty, dated template for each rehearsal the Unit owes (going back, a failing deployment, the restore, the alarm proofs, the measured speeds); `docs/examples.md` pointing at the one operation, one database access, one end-to-end test and one Terraform module that later Units copy.
- [x] **Step 15: The infrastructure scan's six findings on pull request 12.** (US9.1, US9.2) Three kinds, each settled the way the security requirement on scans asks: fixed, or excepted with a recorded reason.
  - *Transport security header (2 findings, `CKV_AWS_259`, on the two response-header rules in `infra/modules/edge/main.tf`).* Set the header to cover every name beneath the site's (`include_subdomains = true`); that is a real tightening, and both names beneath production's, including the test site, are HTTPS only. Leave "preload" off and record the exception with its reason on both rules: preload asks browsers to build the rule in for the whole registered domain, which holds other sites of the maintainer's and is not this project's to commit.
  - *Availability Zones looked up, not named (1 finding, `CKV_AWS_394`, in `infra/modules/network/main.tf`).* Replace the lookup with a module variable naming two zones, default `us-east-1a` and `us-east-1b`, validated to be exactly two different ones. A looked-up list can change when AWS adds a zone, which would move a subnet and the database in it. Remove the lookup's stand-in from the two existing Terraform test files, and add one assertion that the two subnets are in the two zones named.
  - *Security groups reported as unattached (3 findings, `CKV2_AWS_5`, in `infra/modules/network/main.tf`).* A false alarm: each is attached in another module that receives its identifier. Record an exception with that reason on each of the three.
  - Then: `terraform fmt`, `terraform validate` and `terraform test` in both Terraform folders; `npm run check`; add a short section to `code-summary.md`; commit on the branch `u1-thin-slice` and push, so the scan runs again on the pull request. No test is weakened and no check is switched off for the whole project.

## Story to step

| Story | Steps |
|-------|-------|
| US9.1 Change the system safely | 1, 2, 13 |
| US9.2 Rebuild everything from the repository | 3, 4, 9, 11, 13, 14 |
| US9.3 Hear about problems | 5, 7, 8, 9, 13 |
| US9.4 Go back to the previous version | 4, 13, 14 |

## Carried in from the checks of the design, and settled here

| Point | Settled in |
|-------|------------|
| The slice's Problem codes should not list `tooManyRequests`, which it never answers with | Step 7 uses only `invalidInput`, `notFound`, `serverError` |
| Retrying an approved Release in production must not put an older version over a newer one | Step 13: `deliver` refuses to deploy a Release older than the one running |
| Where each Release's function version number is kept | Step 13: recorded on the GitHub deployment and as a tag on the function version |
| The change runner must confirm a user is missing before creating it | Step 9 |
| The cross-reference files' small gaps (three requirement numbers, one wording) | Covered in this Unit's own traceability file at Step 14 |

## Open points the maintainer should know before approving

1. **Tags for the budget take time.** A budget that counts only tagged resources needs the tag `project` to be switched on for cost reporting in the account, which the setup does by script, and AWS can take up to a day to start counting by it. Until then the budget shows nothing. Costs that cannot carry a tag, such as some data transfer, are not counted by it.
2. **Conditions that confine each pipeline identity at the edge and in DNS** are written as designed and are unverified until the setup is first run; anything AWS refuses is reported then.
3. **The access gate's log lines and the size limit of its password page** are still unverified against AWS's documentation; Step 11 keeps the page small and Step 13 declares the log group if the service allows it.
4. **Sizes are estimates.** This is the largest plan of the Bolt: roughly 120 new files. The delivery plan allows moving two items out if it drags (the rehearsal of going back, and the email on a forced error); both are rehearsals done after deployment, not code, so nothing in this plan would move.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "We implement each testable layer of a piece, then write and run that layer's tests before the piece is merged.",
  "scope": "feature",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop`, `classic` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Methodology evidence**: The owner's interview answer (Q4): tests are written after the code for each layer, before the piece is merged. The repository has no tests and no earlier habit to follow.\n- **Ordering**: We implement each testable layer of a piece, then write and run that layer's tests before the piece is merged.\n- Coverage floor: a merge is refused when fewer than 80% of lines are covered\n  by tests. The pipeline checks this on the pull request.\n- Tests are part of every piece. A piece without its tests is not done.\n- Tooling: Vitest for unit and integration tests, Testcontainers for\n  integration tests against a real PostgreSQL, Playwright for end-to-end tests.\n- Unit tests cover every module with logic. Integration tests cover every SQL\n  statement and every API route. End-to-end tests cover the key journeys:\n  browse, upload, download, rename, delete, sign-in, and a rejected anonymous\n  write.\n- We mock AWS calls at the SDK boundary. Integration tests run against a real\n  PostgreSQL.\n- Security checks (dependency audit and a scan of the infrastructure code) run\n  in the pipeline.\n- A scripted migration check, kept in the repository, compares file and folder\n  counts and sizes with the source export.\n- Test files sit next to the source they test and use `describe` and `it`.\n- Performance tests are not part of the first release."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Meet an 80% line-coverage floor.",
      "Run the selected tests in CI before merge."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:bec9af1dda099b4d18c908f452547a1aa0eb0b46adfef5fb37191e41fb9de48a",
  "contract_sha256": "sha256:b048b7114eba63b8a98f6999d1ba2033d751b991c173adf5e2c15fa4396df602"
}
```
