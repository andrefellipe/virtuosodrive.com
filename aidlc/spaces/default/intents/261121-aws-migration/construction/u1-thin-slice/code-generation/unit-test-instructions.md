# Unit Test Instructions: U1, the thin slice

How this Unit's tests are set up and run. Everything here concerns this Unit
only.

## Set-up

- **Runner:** Vitest, configured once in `vitest.config.ts` at the repository's root for the workspaces `server`, `db-migrate`, `web`, `edge` and `scripts`. Test files sit next to the source they test, named `*.test.ts` or `*.test.tsx`, and use `describe` and `it`.
- **Page tests:** React Testing Library in a jsdom environment, for files under `web/`.
- **Integration tests:** named `*.integration.test.ts`. They start PostgreSQL in a container with Testcontainers, so Docker must be running. The database is never replaced by a stand-in.
- **End-to-end tests:** Playwright, under `e2e/`. They need a deployed environment and its access password, and are not part of this Unit's local run.
- **Prerequisites:** Node.js 24, npm, Docker. Install with `npm ci` at the repository's root.

## Running this Unit's tests

Unit and integration tests of this Unit, by exact folders:

```
npx vitest run server db-migrate web edge scripts
```

This command works from Step 2 of the plan onwards, when one trivial test
exists, and grows with each layer. It runs no coverage threshold.

Unit tests only, when Docker is not available:

```
npx vitest run server db-migrate web edge scripts --exclude '**/*.integration.test.ts'
```

Coverage of this Unit's files, as a command of its own:

```
npx vitest run server db-migrate web edge scripts --coverage
```

Terraform's own tests, which touch no AWS account:

```
terraform -chdir=infra/environment test
```

End-to-end tests, against a deployed environment only (run by the pipeline;
by hand only with that environment's address and access password in the
environment variables the tests read):

```
npx playwright test --config e2e/playwright.config.ts
```

## Expected coverage

- The project's floor is **80% of lines of all new TypeScript**, as one figure. The old `app/` folder, generated files, configuration files and the tests themselves are not counted. The threshold is set in `vitest.config.ts` and is never lowered to make a run pass.
- That floor is judged by Build and Test on the full suite of the assembled project. The coverage command above reports this Unit's figure; because this is the first Unit, the two are the same for now.
- If the coverage command exits with an error only because of the threshold while every test passed, that is recorded with the results; it is not a failed test.
- Terraform has no line-coverage tool; its checks are the format check, validation, Checkov and the two `terraform test` files.

## What is tested, and roughly how much

| Component | Kind | Tests |
|-----------|------|-------|
| Database changes (`db-migrate/migrations`) | Integration | 4 |
| Change runner (`db-migrate/src`) | Unit | 6 |
| Database access (`server/src/db`) | Integration and unit | 5 and 6 |
| Request steps (`server/src/http`) | Unit | 16 |
| Logging and measurements (`server/src/log`) | Unit | 10 |
| Operations through the function's entry point (`server/src/operations`) | Integration and unit | 8 and 6 |
| OpenAPI agreement | Unit | 2 |
| Page: status component (`web/src`) | Unit | 8 |
| Page: calls to the server (`web/src/api`) | Unit | 10 |
| Access gate and password page (`edge`) | Unit | 12 |
| Scripts: smoke check, measurement, repository checks (`scripts`) | Unit | 18 |
| Terraform naming and alarm switch | `terraform test` | 2 |
| End-to-end | Playwright, written here and first run by the pipeline | 6 |

## Stand-ins

- **The database:** never. Integration tests use a real PostgreSQL in a container.
- **AWS services:** replaced at the SDK's boundary. The secrets client and the sign-in token maker are passed into the code that uses them, and tests pass in fakes.
- **Time:** Vitest's fake timers for the deadline and the retry timing.
- **The server, in page tests:** the browser's `fetch` is replaced per test.
- **The edge runtime, in gate tests:** the gate is a plain function of an event; tests call it directly with events of the documented shape.

## Test data

- Integration tests create their database fresh for each test file by applying the Unit's own SQL files; nothing is shared between files.
- The one row of `site_information` is the only data.
- No real email address, password or secret appears in any test; example addresses use `example.com`.
