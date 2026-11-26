# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Way of Working

- **Integration branch**: aws-migration
- Every finished piece of work merges into `aws-migration`. We add no release
  or `develop` branches.
- Every piece goes through a pull request on GitHub, and the pipeline's checks
  must pass before it merges. Nothing is committed straight to `aws-migration`.
- `master` stays as the unchanged record of the Firebase site. We merge
  `aws-migration` into `master` once, when the AWS version is accepted.
- We work on one piece at a time, on a short-lived branch started from
  `aws-migration`.
- Each piece lands on `aws-migration` as one squashed commit named after the
  piece. This is the framework default; we have not chosen another merge style.
- AI-DLC's own tooling lands a piece with a merge on the developer's machine,
  while our rule is a pull request on GitHub. How the two fit together is for
  the delivery planning and pipeline stages to settle; until then the pull
  request rule stands.

## Walking Skeleton

- We always build a thin end-to-end slice first. Yes: the first piece of work
  is a walking skeleton, and no feature starts before it is working.
- The slice is the pipeline and the infrastructure plus one trivial page, one
  server call and one database read, deployed to AWS by the pipeline.
- The slice carries no product feature. It proves that the pieces connect, and
  it leaves the working examples that later pieces follow (an API route with
  its test, a database repository with its integration test, an infrastructure
  construct).
- The owner checks the deployed slice and approves it before the second piece
  starts.

## Testing Posture

- **Methodology**: test-after
- **Methodology evidence**: The owner's interview answer (Q4): tests are written after the code for each layer, before the piece is merged. The repository has no tests and no earlier habit to follow.
- **Ordering**: We implement each testable layer of a piece, then write and run that layer's tests before the piece is merged.
- Coverage floor: a merge is refused when fewer than 80% of lines are covered
  by tests. The pipeline checks this on the pull request.
- Tests are part of every piece. A piece without its tests is not done.
- Tooling: Vitest for unit and integration tests, Testcontainers for
  integration tests against a real PostgreSQL, Playwright for end-to-end tests.
- Unit tests cover every module with logic. Integration tests cover every SQL
  statement and every API route. End-to-end tests cover the key journeys:
  browse, upload, download, rename, delete, sign-in, and a rejected anonymous
  write.
- We mock AWS calls at the SDK boundary. Integration tests run against a real
  PostgreSQL.
- Security checks (dependency audit and a scan of the infrastructure code) run
  in the pipeline.
- A scripted migration check, kept in the repository, compares file and folder
  counts and sizes with the source export.
- Test files sit next to the source they test and use `describe` and `it`.
- Performance tests are not part of the first release.

## Guard Policy

<!-- Affirmed by the team. Mode: strict, relaxed, or off. Strict here holds for every intent, whatever one person asks in chat; relaxed or off here applies to every intent whose policy came from its scope, unless project.md or the person sets another; changing this line changes it. A section under the retired Change Control heading, written by an earlier release, is still read. -->

## Deployment

- We run two environments on AWS: a test environment and production.
- A merge into `aws-migration` deploys to the test environment automatically.
- Production deploys only after the owner approves it by hand.
- Every deployment goes through the pipeline, which signs in to AWS with
  short-lived credentials. Which pipeline product we use is decided at
  pipeline design.
- The end-to-end tests run against the deployed test environment and block the
  production deploy if they fail.
- A production deploy is finished only when a smoke check passes against it.
- Schema changes are versioned migrations kept in the repository and applied
  by the pipeline, each with a tested way back or a documented roll-forward.
- Way back: until the AWS version is accepted, we keep using the Firebase
  site, which stays live and unchanged. After acceptance, we redeploy the
  previous version through the pipeline.
- Whether two environments fit under the cost ceiling of about US$50 a month
  is to be confirmed at infrastructure design.

## Code Style

- New code is TypeScript with `strict` on.
- ESLint with typescript-eslint checks the code and Prettier formats it, with
  Prettier's default settings. Both run in the pipeline, and a failure blocks
  the merge.
- We do not carry the 2019 code's style forward. No existing file is a pattern
  to copy: `app/public/js/VirtuosoController.js` shows what the application
  does, not how new code should look.
- Names follow the language's usual style: camelCase for variables, functions
  and JSON fields, PascalCase for types and classes, kebab-case for API paths.
- Style questions are settled by the linter and formatter configuration in the
  repository, not by review comments.
- The examples left by the first piece of work are the pattern later pieces
  follow.
## Forbidden

<!-- Team-specific forbidden patterns -->

## Mandated

<!-- Team-specific mandates -->

## Corrections

<!-- Self-learning loop appends here. -->
