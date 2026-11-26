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

## Corrected after the pull request's first scan

The infrastructure scan (Checkov 3.4.11) failed 6 of 187 checks on its first
run on the pull request. Each is now fixed, or excepted with its reason
written inside the resource concerned. No check is switched off for the whole
project, and `.checkov.yaml` is unchanged.

| Finding | Where | What was done |
|---------|-------|---------------|
| `CKV_AWS_259`, transport security header (2 findings) | The two response-header rules, `pages` and `server`, in `infra/modules/edge/main.tf` | Tightened: the header now covers every name beneath the site's (`include_subdomains = true`), still for one year. "Preload" stays off, so the check still fails, and the exception is recorded on both rules: preload asks browsers to build the rule in for the whole registered domain, which holds other sites of the maintainer's and is not this project's to commit |
| `CKV_AWS_394`, Availability Zones looked up, not named (1 finding) | `infra/modules/network/main.tf` | Fixed: the lookup is gone. The module has a variable `availability_zones`, default `us-east-1a` and `us-east-1b`, refused unless it names exactly two different zones. A looked-up list can change when AWS adds a zone, which would move a subnet and the database in it |
| `CKV2_AWS_5`, security groups reported as unattached (3 findings) | The groups `database`, `server` and `migrate` in `infra/modules/network/main.tf` | Excepted, as a false alarm: the first is attached to the database in the database module and the other two to the two functions in the server module, each of which receives the group's identifier. The scan does not follow an identifier from one module to another |

With that:

- The network module has a new output, `subnet_availability_zones`, so that a test can read where the subnets are.
- The two Terraform test files no longer carry a stand-in for the zone lookup, and `naming.tftest.hcl` has one more assertion: the two subnets are in `us-east-1a` and `us-east-1b`, in that order. The number of test runs is unchanged (5 in `infra/environment`, 3 in `infra/setup`).
- The access gate's own header in `edge/src/gate.ts` is unchanged: its 401 answer still sends the one-year header without the names beneath.
- The zones' default is written for us-east-1. An environment in another Region would have to pass its own two zones to the module; the environment definition does not pass them today.

Run on 2026-11-26, before commit:

| Command | Result |
|---------|--------|
| `terraform fmt -check -recursive infra` | Clean |
| `terraform -chdir=infra/environment validate` | Valid |
| `terraform -chdir=infra/setup validate` | Valid |
| `terraform -chdir=infra/environment test` | 5 runs passed, 0 failed |
| `terraform -chdir=infra/setup test` | 3 runs passed, 0 failed |
| `checkov --config-file .checkov.yaml` (3.4.11, in a temporary Python environment, since removed) | 181 passed, 0 failed, 78 skipped |
| `npm run check` | Ran through to its last step: format, lint, type check, tests with coverage (lines 91.64%, 757 of 826), build, repository checks (774 files) |
| `npx vitest run server db-migrate web edge scripts` | 26 files, 189 tests passed, 0 failed |

## Corrected after the pipeline's first run

The first run of the `deliver` workflow, on 2026-11-26, created these in the
test environment: the network, the edge, the certificate, the name records,
the buckets, the secrets and the log groups. It then stopped at the database.

**What AWS refused, and why.** The database's settings group gave
`log_connections` the value `1`. PostgreSQL 18 changed that setting from on
or off to a list of what to log about each new connection. For the
`postgres18` family AWS allows `receipt`, `authentication`, `authorization`,
`setup_durations` and `all`, so `1` is no longer a value it accepts. The
database is created after its settings group, so it was not created either.

**What was changed.**

- `infra/modules/database/main.tf`: `log_connections` is now `all`, which logs every stage of every new connection, as `1` did before. The volume is small, because the server keeps one connection per running copy. A comment above the setting says why.
- The database module has a new output, `parameters`, giving the settings group's settings as name to value, so that a test can read them. A test cannot read a resource inside a module directly.
- `infra/environment/tests/naming.tftest.hcl` has one more assertion, in its first run: the settings group gives `log_connections` the value `all`. With the old value put back for a moment, that run failed on this assertion, so the assertion does check the setting. No existing assertion was changed, and the number of test runs is unchanged (5 in `infra/environment`, 3 in `infra/setup`).

**Checked against AWS on 2026-11-26 and accepted as written:** the group's
other two settings (`rds.force_ssl` and `log_min_duration_statement`), the
database's size (`db.t4g.micro`) and the certificate authority's name
(`rds-ca-rsa2048-g1`). That check also settles one point under "Not verified"
below: AWS offers the settings family `postgres18`.

**What the first run left behind, and the second change.** The first run did
not fail cleanly. AWS created the settings group `vd-test-postgres18` and
then refused the value, and Terraform's state records that group as tainted,
which means it will be replaced (both checked on 2026-11-26, read-only). The
group had a fixed name and is replaced by creating the new one before
removing the old. A new group with the same name would have been refused as
already existing, so the next run would have stopped at the same place for a
different reason.

- `infra/modules/database/main.tf`: the settings group now has a name that begins `<prefix>-postgres<major version>-` and ends in a generated suffix (`name_prefix`). A replacement gets a new name, is created first, and the old group is removed afterwards. The name still begins with the environment's prefix, which the pipeline identity's outer limit relies on. A comment above the group says why.
- The half-made group is removed by the pipeline on its next run, as part of that replacement. Nothing is removed by hand.
- The database module has a new output, `parameter_group_name_prefix`. Its output `names` no longer lists the settings group, because the end of the group's name is not known until the group exists, and a check on an unknown name fails the whole naming test. The other 31 names are checked exactly as before.
- `infra/environment/tests/naming.tftest.hcl` has two more assertions: the group's name prefix is `vd-test-postgres18-` in the test environment's run and `vd-prod-postgres18-` in production's. The second is one more than the plan names; it keeps the group's name checked in production, where `names` used to cover it. With the ending hyphen taken away for a moment, both failed. No existing assertion was changed.
- Nothing else in `infra/` refers to the group's name: the database takes it from the group itself, and the setup's identities match database resources by the environment's prefix only.

The fix reaches AWS only through its own pull request to `aws-migration`.
Merging it starts the pipeline again, which carries on from what the first
run created. Nothing was planned or applied against AWS while making it.

Run on 2026-11-26, before commit, and again with the same results after the
second change:

| Command | Result |
|---------|--------|
| `terraform fmt -check -recursive infra` | Clean |
| `terraform -chdir=infra/environment validate` | Valid |
| `terraform -chdir=infra/setup validate` | Valid |
| `terraform -chdir=infra/environment test` | 5 runs passed, 0 failed |
| `terraform -chdir=infra/setup test` | 3 runs passed, 0 failed |
| `npm run check` | Exit 0: format, lint, type check, 189 tests passed in 26 files with coverage (lines 91.64%, 757 of 826), build, repository checks (776 files) |

Not run for this fix: Checkov, which is not installed on this machine and
runs on the pull request; and anything against AWS.

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
