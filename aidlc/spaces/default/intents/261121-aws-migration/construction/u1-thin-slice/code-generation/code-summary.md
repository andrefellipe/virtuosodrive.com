# Code Summary: U1, the thin slice

All 14 steps of
`aidlc/spaces/default/intents/261121-aws-migration/construction/u1-thin-slice/code-generation/code-generation-plan.md`
are built. Nothing has been deployed, committed or pushed, and no AWS or
GitHub setting has been changed. The full list of files is in
`source-manifest.json` beside this file (150 files: 147 created, 3 changed).

## What was built

| Part | Where | What it is |
|------|-------|------------|
| Page | `web/` | React with Vite. Shows the name and logo, a status line, the version and the environment. Calls the server with a 10-second limit and two retries |
| Server | `server/` | One Lambda function with two operations, `GET /v1/health` and `GET /v1/site-information`, the request steps around them, logging, measurements, and `server/openapi.yaml` |
| Database changes | `db-migrate/` | Table `site_information`, the users `app` and `migrator`, and the function that applies changes with node-pg-migrate |
| Access gate | `edge/` | The CloudFront Function that asks for the access password, and its password page |
| Scripts | `scripts/` | Build, smoke check, the 100-call measurement, page-size check, repository checks, and the record of which Release runs where |
| End-to-end tests | `e2e/` | Six Playwright tests, in three browser engines at two widths |
| Infrastructure | `infra/setup`, `infra/environment`, `infra/modules/{network,database,server,edge,monitoring}` | Terraform: the one-time setup (budget, identities, state bucket) and one environment definition used for test and production |
| Pipeline | `.github/workflows/`, `.github/actions/deploy/` | `checks`, `deliver`, `go-back`, `compare`, and one shared deploy action |
| Documents | `docs/` | `operations.md` (what a person does by hand), `examples.md` (the patterns later Units copy), and five empty records under `docs/records/` for the rehearsals |

In the old `app/` folder: `node_modules` is no longer tracked by Git (the
folder stays on disk), and `formidable` is removed from `app/package.json`
and its lockfile. Nothing under `app/public` changed.

## Test results

Run again by the conductor after the build, on 2026-11-25:

| Command | Result |
|---------|--------|
| `npx vitest run server db-migrate web edge scripts --coverage` | 26 files, 189 tests passed, 0 failed. Lines 91.64% (757 of 826); statements 91.24%; branches 87.93%; functions 90.82% |
| `npm run check` | Exit 0: format, lint, type check, tests with coverage, build, repository checks (728 files) |
| `terraform -chdir=infra/environment test` | 5 runs passed, 0 failed, with a stand-in provider and no AWS account |

Reported by the developer and not re-run: the unit-only command (167
passed); `terraform fmt -check` and `terraform validate` in both Terraform
folders (clean and valid); `npm audit --audit-level=high` (exit 0, 8
moderate findings); `bash -n` on the two setup scripts (syntax valid).

Of the 189 tests, 167 are unit tests and 22 are integration tests against
PostgreSQL 18.1 in a container with TLS on. The 80% threshold in
`vitest.config.ts` was not lowered. The repository had no tests before, so
there was no earlier suite to keep passing.

Build sizes: the page is 75,325 bytes compressed against a limit of 307,200;
the access gate is 5,771 bytes against CloudFront's limit of 10,240.

## Written but not run

| What | Why |
|------|-----|
| The six end-to-end tests | They need a deployed environment; the pipeline runs them first |
| Checkov and its exceptions | Not installed on this machine. Findings may appear on the first pull request |
| Gitleaks | Not installed on this machine |
| The four workflows and the deploy action | Parsed as YAML only; never executed |
| `infra/setup/setup.sh`, `infra/setup/github-settings.sh` | Syntax-checked only |
| All Terraform against AWS | No plan and no apply was run |

## Where the code differs from the plan or the designs

**Versions and packages**

1. TypeScript 6.0.3 and ESLint 9.39.5, not the newest major versions, because typescript-eslint and eslint-plugin-react do not support those yet.
2. Two packages outside the approved list: `@testing-library/dom` (required by React Testing Library) and `@eslint/js` (ESLint's own rule set). The maintainer has not approved them yet.
3. Used as parts of approved families, for the maintainer to confirm: `@testcontainers/postgresql`, `@vitest/coverage-v8`, `@aws-sdk/client-secrets-manager`, `@aws-sdk/rds-signer`, the Powertools logger and metrics packages, and type packages.
4. Bootstrap: only its precompiled "reboot" stylesheet is used. The header and button styles are the page's own CSS, because the finer parts need Sass, which is not approved.
5. No Terraform provider beyond the AWS one.

**Added beyond the plan's steps**

6. `GET /v1/forced-failure`, from observability design O5, to prove the error-rate alarm. It exists only when the Terraform variable `forced_failure` is true, and both Terraform and the server refuse it in production. It is not in `openapi.yaml`.
7. `.github/actions/deploy/action.yml`, shared by the test and production jobs.
8. `scripts/src/deployment-record.ts`, `releases.ts` and `prune-releases.ts`, with tests.

**Done differently from the design**

9. **Permissions boundaries.** Each allows the needed services, then denies the other environment by name and by tag, everything the setup made, roles without the boundary, and reading log entries. The design said "allow only own-prefixed resources". Resources with neither a name pattern nor tags are not confined; the design already names that gap.
10. **Alarm email.** `setup.sh` subscribes the address with the AWS command line, not Terraform, so the address is not in any Terraform state.
11. **The alarm topic is not encrypted**, because Budgets and CloudWatch alarms cannot publish to a topic encrypted with the service's own key. Recorded as a Checkov exception. This departs from NFR4.1 for one resource that stores nothing.
12. **Compatibility check: half built.** `checks.yml` runs each in-reach Release's tests against the pull request's database changes; that half is what AC9.4.3, BR6.3 and NFR15.10 ask for, and `traceability.json` marks them met. Running the in-reach end-to-end tests against the new server (NFR10.7) is not built, because there is no way yet to start the server locally. The workflow prints this. `traceability.json` marks NFR10.7 as deferred to the code step of the next Unit: in this Unit no earlier Release exists for the check to run against, and the next Unit is the first that could break one. The maintainer has not yet agreed to that deferral.
13. **Queueing in `deliver`.** GitHub keeps one waiting run per group, so with three quick merges the middle run is cancelled, not queued. Its changes are in the next Release.
14. **The 100-call measurement is timed at the caller**, which includes the network and is stricter than the design.
15. **Deployment records** are written at the end of each Deployment under `releases-test` or `releases-production`; the Release is also in the function version's description, because Lambda versions cannot be tagged.
16. **Refusing an older Release** uses Git ancestry against the running Release's commit.
17. **Measurements.** A 403 from the origin check writes a log entry but no measurements; 404s count in `Requests`.
18. **Database.** `engine_version = "18"`; `prevent_destroy` is on in both environments because Terraform cannot make it a variable.
19. **Test set-up.** Vitest is configured without "projects"; the two page test files name their jsdom environment themselves.
20. **RDS certificate authorities** are committed as `server/certs/rds-us-east-1-bundle.pem` (three public certificates downloaded from AWS).

## Corrected after the first review

All in the one-time setup, which no local test covered before:

1. **The budget's tag filter** was written with Terraform's escape for a dollar sign and a brace, so it would have been sent to AWS unfilled and the budget would have counted nothing. It is now built with `format()` in `infra/setup/budget.tf`.
2. **The alarm topic's policy** no longer names the pipeline's identities (their own policy lets them publish), so it is created with the topic and before the budget. `setup.sh` targets it in its first step and the budget depends on it.
3. **The permissions boundaries** no longer deny resources tagged `environment = account`. That tag is on the alarm topic, so the pipeline's own failure notice would have been refused. What the setup made stays protected by name and by the short list of allowed actions.
4. **`setup.sh` run again after a failed first run** now looks for where the state actually is (on the machine, in the bucket, both, or neither) and no longer assumes that an existing bucket holds it. It confirms the state arrived in the bucket before removing the local copy.
5. The boundaries now allow the two network-address actions the function roles ask for.
6. `setup.sh` reads the account's limit on simultaneous function copies and warns when it is under the 127 the environments need.
7. New `infra/setup/tests/setup.tftest.hcl`: three tests (the exact tag filter; each boundary denies by tag only the other environment and fits IAM's size limit; the topic's policy does not depend on the identities). They run with `terraform -chdir=infra/setup test`, pass (3 of 3), and are added to the `checks` workflow. `unit-test-instructions.md` is part of the approved plan and still names only the first Terraform test command.

Still open from that review, for the maintainer: the repository's owner name on GitHub and the site's domain appear in committed files (`infra/setup/variables.tf`, `infra/setup/github-settings.sh`, the two `.tfvars` files, `go-back.yml`, `server/openapi.yaml`, `docs/operations.md` and tests). Both are public by their nature, but the maintainer has not said whether they may be committed. The site's name is also written in more than one place.

## Not verified

- Whether AWS accepts the IAM policies, the tag conditions and the Route 53 record-name condition.
- Whether the CloudFront Functions runtime accepts the built gate; it ran only in a Node sandbox.
- Whether response headers policies apply to the gate's own 401 answer. The gate sets its headers itself.
- The gate's log group name.
- Whether RDS offers PostgreSQL 18 with parameter family `postgres18` in us-east-1.
- Whether a budget and the cost-allocation tag can be set up by the script without a console step.
- The `environment:` expression in `go-back.yml` and `compare.yml`, which relies on an empty name meaning no environment.
- Whether GitHub's plan allows branch protection and required reviewers.
- The provider lock file for Linux was recorded on macOS and not exercised on Linux.

## Carried forward

- The rehearsals (going back, a failing deployment, a restore, the alarm proofs), the cold-start and page-speed measurements, and the hand procedures in `docs/operations.md` can only be done after the first deployment. Their records under `docs/records/` are empty.
- `code-generation-plan.md` points to `code-generation-questions.md` for four earlier answers; that file now holds only the plan approval. The answers are in the decision log and in the plan itself.
- The developer made one edit through a shell one-off, against the working rule for file edits. The file's content is as intended.
