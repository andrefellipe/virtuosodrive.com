# Unit Test Instructions: U3, browsing and selecting

How this Unit's tests are set up and run. Everything here concerns this Unit
only. The runner, the page-test environment and Testcontainers are U1's and
are not changed.

## Set-up

- **Runner:** Vitest, configured once in `vitest.config.ts` at the repository's root. Test files sit next to the source they test, named `*.test.ts` or `*.test.tsx`, and use `describe` and `it`.
- **Page tests:** React Testing Library in a jsdom environment, for files under `web/`.
- **Integration tests:** named `*.integration.test.ts`. They start PostgreSQL 18 in a container with Testcontainers, so Docker must be running. The database is never replaced by a stand-in.
- **Large tests:** named `*.large.integration.test.ts` (the 4,000-item folder). They are integration tests that take longer; the pull request's checks and `npm run check` run them, the quick command below does not.
- **End-to-end tests:** Playwright, under `e2e/`. They need the deployed test environment with its sample content, and are run by the pipeline, not locally.
- **Prerequisites:** Node.js 24, npm, Docker. Install with `npm ci` at the repository's root.

## Running this Unit's tests

Unit and integration tests of the folders this Unit adds or changes. U3
changes shared files of U1's (`server/src/http`, `server/src/log`,
`server/src/db`, `web/src/api`), so their tests are in this run on purpose:
they are what shows U1 still works.

```
npx vitest run server/src/drive server/src/operations server/src/http server/src/log server/src/db server/src/openapi.test.ts db-migrate/src web/src scripts/src
```

This command works from Step 2 of the plan onwards, on the project as it
stands, and grows with each layer. It runs no coverage threshold.

The quick run while working: unit tests only, with no Docker and no large
tests:

```
npx vitest run server/src/drive server/src/operations server/src/http server/src/log server/src/db server/src/openapi.test.ts db-migrate/src web/src scripts/src --exclude '**/*.integration.test.ts'
```

Coverage of the same folders, as a command of its own:

```
npx vitest run server/src/drive server/src/operations server/src/http server/src/log server/src/db server/src/openapi.test.ts db-migrate/src web/src scripts/src --coverage
```

Terraform's own tests, which touch no AWS account:

```
terraform -chdir=infra/environment test
```

End-to-end tests of this Unit, against the deployed test environment only
(run by the pipeline; by hand only with that environment's address and
access password in the environment variables the tests read):

```
npx playwright test --config e2e/playwright.config.ts e2e/tests/browsing.spec.ts e2e/tests/selecting.spec.ts
```

## Expected coverage

- The project's floor is **80% of lines of all new TypeScript**, one figure over U1's and U3's code together (NFR12.23). The threshold is set in `vitest.config.ts` and is never lowered or split to make a run pass.
- That floor is judged by Build and Test on the full suite of the assembled project. The coverage command above reports the figure for this Unit's folders. If it exits with an error only because of the threshold while every selected test passed, that is recorded with the results; it is not a failed test.
- Terraform has no line-coverage tool; its checks are the format check, validation, Checkov and `terraform test`.
- Every module with logic that U3 adds has unit tests; every statement and every rule the database holds has an integration test (NFR12.20, NFR12.21).

## What is tested, and roughly how much

| Component | Kind | Tests |
|-----------|------|-------|
| The `items` table: one per rule, the fifteen name cases, the listed characters, rights (`db-migrate/migrations`) | Integration | 32 |
| Identifiers, names, version tag (`server/src/drive`) | Unit | 40 |
| Folder reading, file reading, change step, transactions (`server/src/drive`, `server/src/db`) | Integration | 22 |
| The 4,000-item folder | Large integration | 2 |
| Request steps and log entry, as changed (`server/src/http`, `server/src/log`) | Unit | 22 |
| The folder operation through the function's entry point (`server/src/operations`) | Integration | 14 |
| The sample loader (`db-migrate/src`) | Unit and integration | 6 and 5 |
| Selection, address, formatting (`web/src/folder`) | Unit | 36 |
| Folder screen, list, breadcrumb, action bar, status line; the call function (`web/src`) | Unit, with React Testing Library | 22 |
| Smoke check option and the four gates (`scripts/src`) | Unit | 14 |
| The edge's five headers; the saved searches | `terraform test` | 2 |
| End-to-end journeys | Playwright, written here and first run by the pipeline | 9 |

The selection function is tested from the table in the design (W4), one
case per row and per rule, with and without an anchor.

## Stand-ins

- **The database:** never. Integration tests use a real PostgreSQL in a container.
- **AWS services:** replaced at the SDK's boundary, as in U1.
- **Time:** Vitest's fake timers for deadlines, retries and the bounded wait for a folder.
- **The server, in page tests:** the browser's `fetch` is replaced per test.
- **The deployed site, in tests of the smoke check and the gates:** a stand-in server inside the test, with and without the folder route.
- **The browser's history and visibility, in page tests:** jsdom's own.

## Test data

- Integration tests create their own folders and files in their set-up; none relies on the loaded sample content (NFR12.24). The database is created fresh for each test file by applying the project's change files.
- Only the end-to-end tests rely on the sample content, and each names the sample entries it uses and finds them by walking from "All" by name, never by a fixed identifier.
- The fifteen "Name cases" come from `aidlc/spaces/default/intents/261121-aws-migration/construction/u3-browsing/nfr-requirements/security-requirements.md` and are kept as one table in the tests, used by the module's tests and the database's tests alike.
- No real email address, password or secret appears in any test; no name of a real person or file from the old site is used as sample content.
