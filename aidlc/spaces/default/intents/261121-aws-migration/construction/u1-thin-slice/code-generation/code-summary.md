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

## Corrected after the pipeline's second run

The second run of the `deliver` workflow, on 2026-11-26, finished Terraform.
Everything Terraform defines for the test environment now exists, including
the database, the two functions, the entry point and the dashboard. The
half-made settings group left by the first run was replaced and removed, as
planned. The run then failed at the next step, the database changes.

**What failed, and why.** The change runner could not sign in to the new
database with the master password from Secrets Manager. In
`infra/modules/database/main.tf` both the stored secret and the database took
the password straight from the source that generates it, and that source
gives a new value at every run. The secret was written in the first run and
keeps that run's value. The database was created in the second run and was
given the second run's value. So the two held different passwords (checked on
2026-11-26, read-only). The access password and the edge's secret were never
affected: what uses them reads the stored value, not the generating source.

**What was changed.**

- `infra/modules/database/main.tf`: the database now takes its master password from the stored secret's own value (a local, `master_password`, read out of the secret). Only the secret takes a value from the generating source, once, when it is first written. This is the same wiring the access password and the edge's secret already had. The comment above the generating source now describes this.
- In the same file, `password` is no longer in the list of things Terraform ignores on the database. The pipeline's next run therefore sets the existing test database's password to the secret's. That is a change in place: the database is not replaced, `prevent_destroy` stays, and `engine_version` is still ignored.
- No password is printed or written anywhere by this change. There is no new output, and Terraform treats the value read from the secret as sensitive, as it did the generated one.

**How the test covers it.** New file
`infra/environment/tests/master-password.tftest.hcl`, three runs that apply
the database module by itself with the stand-in provider, touching no AWS
account. The test tool can vary the generated value between runs
(`override_data` in each run), and can create the secret alone first (a
targeted apply), so the fault is reproduced as it happened:

1. The first run creates only the secret, with the generated value set to one placeholder.
2. The second run creates everything else, including the database, with the generated value set to a different placeholder. It asserts that the secret kept the first value and that the database's password equals the secret's.
3. The third run generates a third value and asserts that neither the secret nor the database changed.

With the old wiring put back for a moment, the second and third runs failed
(the database held the second run's placeholder, the secret the first's);
with the fix restored, all three pass. The first run prints Terraform's
standing warning about targeted applies; that is expected.

What the test cannot cover: the correction of the existing test database,
whose password already differs from the secret's. The stand-in provider
cannot start from a database with another password without the old code, so
that the next run changes the password in place is reasoned from how
Terraform treats a changed, no-longer-ignored `password`, and is first proved
by the pipeline's next run. Whether AWS applies the new password before the
change runner signs in during that same run is also unproved until then: AWS
documents a master password change as applied asynchronously, as soon as
possible, whatever the database's "apply immediately" setting. If the change
runner is too early, running the pipeline again would settle it.

The new test's runs use a module named in the test file, so
`terraform init -backend=false` must have been run after the file was added.
The `checks` workflow already runs that before the tests.

**Three small corrections left by the earlier reviews.**

- `edge/src/gate.ts`: the access gate's own 401 answer now sends the transport security header with `includeSubDomains`, as the edge's rules do. `edge/src/gate.test.ts` asserts the exact header. This replaces the note in "Corrected after the pull request's first scan" that the gate's header was unchanged. The built gate is 5,808 bytes against the limit of 10,240.
- `infra/modules/database/main.tf`: a comment on the settings group says that changing its description or family replaces it, and that a replaced group takes effect only at the database's next restart.
- The line under "Not verified" asking whether RDS offers PostgreSQL 18 with the `postgres18` family is removed: the pipeline created both.

`source-manifest.json` lists the new test file.

Run on 2026-11-26, before commit:

| Command | Result |
|---------|--------|
| `terraform fmt -check -recursive infra` | Clean (after one alignment fix by `terraform fmt`) |
| `terraform -chdir=infra/environment validate` | Valid |
| `terraform -chdir=infra/setup validate` | Valid |
| `terraform -chdir=infra/environment test` | 8 runs passed, 0 failed (5 as before, 3 new) |
| `terraform -chdir=infra/setup test` | 3 runs passed, 0 failed |
| `npm run check` | Exit 0: format, lint, type check, 189 tests passed in 26 files with coverage (lines 91.64%, 757 of 826), build, repository checks (779 files) |

The number of unit and integration tests is unchanged at 189: the gate's
header is one more assertion in an existing test. Not run for this fix:
Checkov, which is not installed on this machine and runs on the pull request;
the end-to-end tests; and anything against AWS.

## Corrected after the maintainer tried the test site

The pipeline's third run, on 2026-11-26, deployed U1 to the test environment:
the smoke check, all 36 end-to-end runs and the speed measurement passed. The
maintainer then opened the test site on a phone, typed the access password,
and was shown the password page again.

**What failed, and why.** The access gate answered with a security policy
that allowed exactly the script and the style written inside its password
page. The edge's header rule for pages (`aws_cloudfront_response_headers_policy.pages`,
whose policy has `override = true`) applies to the gate's own answers too,
and replaced that policy with the ordinary page's, which allows scripts and
styles only as files from the site itself. The browser therefore blocked the
page's script. With the script blocked, the browser submitted the form the
plain way, which reloaded the page and wrote what was typed into the address
as a query. No end-to-end test caught it, because every test got in by
setting the access cookie and none typed into the page.

**What was changed.**

- **The page's script and style are files.** The gate answers two fixed paths itself, `/access-password.js` and `/access-password.css`, with status 200, the content types `text/javascript; charset=utf-8` and `text/css; charset=utf-8`, and `cache-control: no-store`. It answers them before it looks at the cookie, so with or without one, and writes no "access refused" line for them. They hold nothing secret. With the gate's flag off they are passed on to the origin like any other path, because the password page is not shown then. The names cannot be a file of the page's build (`/index.html` and under `/r/<version>/`) or a path of the server's (under `/v1`). (`edge/src/gate.ts`, `edge/src/password-page.ts`)
- **The page has no script or style inside it.** It refers to the two files, and has no style attribute and no event handler attribute. It works under the policy the browser actually receives and under the gate's own.
- **The gate's own policy** is now `default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, so that the two policies agree on scripts and styles.
- **The fingerprints are gone.** `scriptHash` and `styleHash` are removed from the gate's settings, their two placeholders from `edge/src/handler.ts`, and the hashing from `scripts/src/build.ts`, which no longer reads the password page's source (`scripts/tsconfig.json` no longer includes it). The built file has two placeholders, both filled in by Terraform, as before; nothing in `infra/` referred to the fingerprints.
- **A plain submission cannot carry the password.** The form's method is `post`, so nothing is written into the address. The field has no `name`, so a plain submission sends nothing of it at all: what was typed leaves the field only through the script. A sentence for browsers without JavaScript is added.
- **The script opens the address's own path again** in place of the current entry of the browser's history (`location.replace(location.pathname)`), where it used to reload. An address that carried a query, such as the one the old page left, is opened without it.
- **The test environment's access password is replaced.** `infra/environment/test.tfvars` sets `access_password_version = 2`. The pipeline generates a new password and gives the gate its SHA-256 in the same run; the end-to-end tests read the new one. Production's has never been used and `production.tfvars` is unchanged.
- `docs/operations.md`, procedure 5, now says how to read the access password, that it is typed once per device and remembered 30 days, and how it is replaced.

**How a person without a working script is treated.** Tried on 2026-11-26 in
Google Chrome on this machine, against the built gate behind a small local
stand-in for the edge (see below): with the script's file blocked and the
edge's policy, pressing Continue sends a `POST` with an empty body to the
same address, the address gains no query, no cookie is set, and the password
page is shown again. With the gate's own policy the browser refuses to send
the form at all (`form-action 'none'`) and the page stays as it is. In
neither case does the password leave the field.

**Tests.**

- `edge/src/gate.test.ts`, 20 tests where there were 14. New: the two paths are answered without a cookie, with a wrong one and with the right one, with their exact headers and bodies, and nothing is logged; paths that only resemble them are refused with 401 and logged; neither file nor the page holds the password or its SHA-256; with the flag off the two paths are passed on; the refusal's exact policy; the page has one empty script element, no style element, no style attribute and no event handler attribute; the form's method is `post` and the field has no name. The existing test of the script now runs it with an address that carries a query and checks that the bare path is opened.
- `scripts/src/commands.test.ts`: the test that runs the built gate in a sandbox now also asks it for the two paths the built page refers to, and checks that the built file has exactly two placeholders left.
- `e2e/tests/thin-slice.spec.ts`, 8 tests where there were 6 (48 runs where there were 36), written and not run. New: with no cookie, open the site, see the password page with 401, type the environment's access password, press Continue, see the answered view; the address has no query; the browser reported no blocked script or style and no error (collected from before the page first opens, across the reload); the cookie `vd_access` exists with `secure` and `sameSite` "Strict". And: a wrong, made-up password shows the password page again with 401, with no query in the address. The existing test of what is refused without the cookie now also asks for the two paths and checks status 200, the exact content types, and that they hold neither the password nor its SHA-256.

**Tried in a real browser, locally.** Because the fault was one no unit test
could show, the built gate (`dist/edge/access-gate.js`, filled in with a
made-up password's SHA-256) was put behind a small local server that does
what the edge does to its answers: replace the security policy with the
edge's and add `nosniff`. Google Chrome, driven by Playwright with a one-off
command and no file left behind, then typed into the page. With the edge's
policy and with the gate's own: the style applied, the script ran, the cookie
was set with `Secure`, `SameSite=Strict` and `Path=/`, the address ended
without a query, the request was let through, and the console reported
nothing about the security policy. A wrong password showed the password page
again. This is one engine on one machine and not the real edge; the pipeline's
end-to-end run is the proof.

Run on 2026-11-26 and 2026-11-27, before commit:

| Command | Result |
|---------|--------|
| `npx vitest run edge scripts`, before any change | 6 files, 59 tests passed |
| `terraform fmt -check -recursive infra` | Clean, exit 0 |
| `terraform -chdir=infra/environment validate` | Valid, exit 0 |
| `terraform -chdir=infra/setup validate` | Valid, exit 0 |
| `terraform -chdir=infra/environment test` | 8 runs passed, 0 failed, exit 0 |
| `terraform -chdir=infra/setup test` | 3 runs passed, 0 failed, exit 0 |
| `npm run check` | Exit 0: format, lint, type check, 195 tests passed in 26 files with coverage (lines 91.68%, 761 of 830), build, repository checks (781 files) |
| `npx playwright test --config e2e/playwright.config.ts --list` | 48 tests in 1 file listed, exit 0; none run |

The built gate is 6,377 bytes against the limit of 10,240 (5,808 before). The
page is 75,322 bytes compressed.

**Different from the plan's wording, or beyond it.**

- The field's `name` is removed, which the plan does not ask for; it asks only that a plain submission not put what was typed in the address. Password managers find a password field by its type and its `autocomplete`, both kept, but this was not tried with one.
- `unit-test-instructions.md` is part of the approved plan and still says 12 tests for the gate and 6 end-to-end tests; there are now 20 and 8.
- The first password is replaced, but the old one stays in the history of the browser it was typed in until that entry is cleared. It no longer opens anything once this is deployed.

## Not verified

- Whether AWS accepts the IAM policies, the tag conditions and the Route 53 record-name condition.
- Whether the CloudFront Functions runtime accepts the built gate as changed here; it ran only in a Node sandbox. The gate before this change does run there.
- The two new end-to-end tests, and the extended one, have not run. Until the pipeline runs them, that the password page works at the real edge, in the three engines, is unproven.
- How the real edge treats the gate's two files: whether it passes their content types and `cache-control` on unchanged, and whether it compresses them. The page's header rule also adds its security policy to them, which is harmless for a script and a style.
- What a person sees after a plain `POST` at the real edge (the script blocked, or JavaScript off). The page's files accept only `GET` and `HEAD`, so the edge may answer its own "method not allowed" page before the gate runs, where the local stand-in showed the password page again. Either way nothing typed is sent.
- The password page with a password manager, now that the field has no `name`.
- The gate's log group name.
- Whether a budget and the cost-allocation tag can be set up by the script without a console step.
- The `environment:` expression in `go-back.yml` and `compare.yml`, which relies on an empty name meaning no environment.
- Whether GitHub's plan allows branch protection and required reviewers.
- The provider lock file for Linux was recorded on macOS and not exercised on Linux.

## Carried forward

- The rehearsals (going back, a failing deployment, a restore, the alarm proofs), the cold-start and page-speed measurements, and the hand procedures in `docs/operations.md` can only be done after the first deployment. Their records under `docs/records/` are empty.
- `code-generation-plan.md` points to `code-generation-questions.md` for four earlier answers; that file now holds only the plan approval. The answers are in the decision log and in the plan itself.
- The developer made one edit through a shell one-off, against the working rule for file edits. The file's content is as intended.
