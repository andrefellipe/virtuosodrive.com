# Evidence: Practices Discovery

> Written by `aidlc-pipeline-deploy-agent`, working alone (no collaborators
> for this scope), from the repository at commit `533329e` on branch
> `aws-migration` and from the owner's interview answers. Nothing was built,
> installed, deployed or run apart from the read-only commands listed below.
> The live site, the Firebase project and the GitHub repository settings were
> not inspected.

## What Was Inspected

### Commands run (all read-only)

| Command | What it showed |
|---|---|
| `git log --all --stat` | 17 commits. Eight application commits by one author, 2019-06-02 to 2019-06-13, all on `master`. Six Dependabot commits dated 2026-11-15, each on its own remote branch. Three commits dated 2026-11-21 on `aws-migration`: AI-DLC set-up, the two input documents, and the ideation record |
| `git log --merges --all` | No merge commit anywhere in the history |
| `git branch -a -vv` | Local: `master` (at `de24f7c`), `aws-migration` (at `533329e`, checked out, tracking `origin/aws-migration`). Remote: `origin/HEAD -> origin/master`, `origin/master`, `origin/aws-migration`, six `origin/dependabot/npm_and_yarn/app/...` branches. No `main` |
| `git tag` | `pre-aidlc-baseline` (on `de24f7c`, the tip of `master`) and `aidlc-start` (on `87ee544`). No version tags |
| `git remote -v` | One remote, `origin`, on GitHub |
| `git ls-files` (outside `app/node_modules`, `.claude`, `aidlc`) | 42 tracked files: the `app/` package, `README.md`, `vision.md`, root configuration. No pipeline, lint, format, type-check or test file |
| File search at the root and in `app/` for `.github`, other pipeline definitions, ESLint, Prettier, EditorConfig, `.nvmrc`, commit hooks, `tsconfig`, `Dockerfile`, Dependabot configuration | Nothing found |
| `git rev-parse HEAD` | `533329e6026fec24eb198b2ec24f43ee153bed36` |
| `aidlc engine now` | `2026-11-25T01:50:33Z` |

### Files read

| File | Used for |
|---|---|
| `app/firebase.json`, `app/.firebaserc` | Deployment target: Firebase Hosting serving `app/public`, one project alias (`default` = `virtuoso-drive`), so one environment |
| `app/package.json` | One script (`start`), no `test`, `lint` or `build` script, no devDependencies |
| `README.md` | Five lines; no set-up, run or deploy notes |
| `vision.md` (matching lines only) | Success measures: automated tests on every change, infrastructure 100% as code, rollback rehearsed; "small Units, each one deployable and verified on its own" |
| `aidlc/spaces/default/codekb/virtuosodrive.com/code-structure.md` | Layout, the single 741-line controller, conventions (four-space indentation, camelCase, `El` suffix, one comment) |
| `aidlc/spaces/default/codekb/virtuosodrive.com/technology-stack.md` | No build, test, lint, type-check or pipeline tooling; one environment; deployment by hand (marked as inference there) |
| `aidlc/spaces/default/codekb/virtuosodrive.com/dependencies.md` | Firebase command-line tool assumed but not declared; no devDependencies; `node_modules/` committed |
| `aidlc/spaces/default/codekb/virtuosodrive.com/code-quality-assessment.md` | Test presence, linting and CI/CD all rated Poor; coverage 0%; no rollback procedure other than redeploying by hand (inference there); TD-01, TD-05, TD-09 |
| `aidlc/spaces/default/codekb/virtuosodrive.com/architecture.md` | Static client calling Firebase directly; configuration and rules "deployed by hand"; no server side in production |
| `aidlc/spaces/default/codekb/virtuosodrive.com/business-overview.md` | One maintainer, code unchanged since June 2019, public audience of students; no release cadence to observe |
| `aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md` | The owner's stated intentions for the new system: Testing table, Pipeline gates, Frameworks (Required, Preferred, Prohibited), Allowed and Disallowed services, Secrets, "While old and new coexist", Open Technical Decisions |
| `aidlc/spaces/default/intents/261121-aws-migration/ideation/approval-handoff/decision-log.md` | Decisions D-01 to D-41, in particular D-12, D-16, D-27 |
| `aidlc/spaces/default/intents/261121-aws-migration/ideation/scope-definition/scope-definition-questions.md` (Q7 only) | Exact wording of D-27: "Foundation first: the pipeline and infrastructure before any feature, so every later piece is deployed through it" |
| `aidlc/spaces/default/intents/261121-aws-migration/aidlc-state.md` (header only) | Scope feature, Depth Standard, Test Strategy Standard, Construction Checkpoints enabled, serial execution, one Unit at a time |
| `aidlc/spaces/default/memory/org.md` (through the rule bundle) | Framework defaults for the five areas, used as suggestions only |
| `aidlc/spaces/default/intents/261121-aws-migration/inception/practices-discovery/practices-discovery-questions.md` | The owner's six answers and the confirmed summary; see "Interview Decisions" |

## What Was Inferred

Each area lists what the repository showed, what was inferred from it, and
what the interview then settled.

### Way of Working

- Observed: direct commits to `master` in 2019; no branches, pull requests, merges or version tags. One author throughout.
- Observed: the migration work lives on `aws-migration`, pushed to GitHub, three commits ahead of `master`. `master` was tagged `pre-aidlc-baseline` before the work began.
- Inferred, then confirmed by the interview (Q1): the owner keeps `master` as it is while the migration is built, merges finished work into `aws-migration`, and merges `aws-migration` into `master` once, when the AWS version is accepted. The framework default, `main`, does not exist here.
- Inferred, then confirmed by the interview (Q2): the Pipeline gates table names a "Pull request" step that blocks the merge, and the 2019 history has no pull requests. The owner chose a pull request for every piece, with the checks passing before it merges.
- Not asked: the merge style. Squash merge and one piece at a time are the framework default and the recorded serial execution; nothing in the repository shows a merge style. `team-practices.md` states the squash merge as the framework default, not as the owner's choice.
- The six Dependabot branches show that GitHub raises dependency updates against `master`. None was merged, so there is no observed practice for handling them. They all touch the Express scaffold, which is marked for removal.
- Commit messages: lower-case free sentences in 2019; capitalised, imperative, some with an `AI-DLC:` prefix in 2026. No convention can be inferred.

### Walking Skeleton

- Observed: no evidence of a thin first slice in 2019; the application was built feature by feature and deployed at the end (commit sequence `1778414` to `7b55d6d`).
- Stated by the owner: D-27, foundation first. Technical environment: the pipeline is "built before the first feature Unit so every Unit deploys through it", and "the first Unit establishes working examples under `examples/`".
- Inferred, then confirmed by the interview (Q3): these two statements could mean a thin end-to-end slice, or pipeline and infrastructure only with no application path through them. The owner chose the slice: the pipeline and infrastructure plus one trivial page, one server call and one database read, deployed to AWS, before any feature.
- Carried into `team-practices.md` without a question of its own: the owner checks the deployed slice and approves it before the second piece starts. This is the framework's checkpoint for a first slice, which is switched on for this work (`aidlc-state.md`).

### Testing Posture

- Observed: no tests, framework, coverage configuration or `test` script (`code-quality-assessment.md`, `technology-stack.md`, `app/package.json`).
- Stated by the owner in the technical environment, without a [confirm] or [decide] mark: the Testing table (unit, integration, end-to-end, security, migration verification; no performance tests in the first release), the tooling (Vitest, Testcontainers, Playwright), mocking rules, test location, naming, and the two pipeline gates.
- Not stated in any document, then settled by the interview: when tests are written (Q4: after the code for each layer, before the piece is merged) and the coverage floor (Q5: a merge is refused below 80% of lines). Both match the framework defaults, and both are now the owner's own answers.
- Decision D-12 confirmed a specific list of statements in the technical environment (one developer; AWS only; PostgreSQL; one dedicated account with a budget alarm; existing site untouched; nothing automated today). The Testing table is not in that list, so it is treated as the owner's stated intention, not as a recorded decision.

### Deployment

- Observed: `app/firebase.json` and `app/.firebaserc` define one Firebase project and no second environment. Commit `7b55d6d` ("deploying it to firebase") is the only deployment trace. No pipeline definition exists.
- Inferred (as in `technology-stack.md` and `code-quality-assessment.md`): deployment was by hand with the Firebase command-line tool; the way back was to redeploy an earlier commit.
- Stated by the owner: pipeline with OIDC and infrastructure as code; end-to-end tests "against the deployed test environment" before deploy; migrations applied by the pipeline; rollback before acceptance is to keep using the Firebase site; a rehearsal run, then a final run in a short read-only window (a few hours is acceptable, D-26); single AWS account; about US$50 a month (D-16).
- Inferred, then confirmed by the interview (Q6): "the deployed test environment" implies two environments, test and production. The owner chose two environments, with production waiting for the owner's approval by hand.
- Carried into `team-practices.md` without a question of its own: a merge deploys to the test environment automatically (framework default, and implied by the wording of Q6); a production deploy is finished only when a smoke check passes (framework rule for the operation phase); after acceptance, the way back is to redeploy the previous version through the pipeline (the lead's proposal).

### Code Style

- Observed: no linter, formatter, EditorConfig, type checker or hook. Conventions in the 2019 code as described in `code-structure.md`.
- Stated by the owner: TypeScript with `strict` on; ESLint with typescript-eslint and Prettier "enforced in the pipeline"; no new plain JavaScript source files; API naming (kebab-case paths, camelCase JSON fields); "No file in the existing codebase is a pattern to copy".
- Not stated: formatter settings (for example indentation width). Code style was not asked in the interview. The questions file told the owner that Prettier's default settings are assumed, and the owner confirmed the summary that says so.

### Sources of the Discovered Rules

All from `aidlc/spaces/default/knowledge/aidlc-shared/technical-environment.md` unless a decision is named.

Every rule in `discovered-rules.md`, with the line it comes from. None comes
from a line marked [confirm] or [decide], and none comes from an interview
answer.

| Rule | Source |
|---|---|
| ALWAYS PostgreSQL as the system of record | Programming Languages, Required ("PostgreSQL is the required data store"); Data, Primary store; D-12 |
| ALWAYS validate every API input | Frameworks Required (Zod: "Validation of every API input", "No unvalidated external input") |
| ALWAYS budget alarm before any other resource | Cloud Environment, Account structure; D-12 |
| ALWAYS maintainer approval for a library not already listed | "Getting a new library approved" |
| ALWAYS encryption at rest; TLS 1.2 or later | Security, Data protection |
| NEVER new plain JavaScript source files | Programming Languages, Prohibited |
| NEVER Google Cloud or Firebase at runtime | Disallowed services; Project Technical Summary; D-12 |
| NEVER write to Firebase or change the live site while the AWS version is built and tested | "While old and new coexist"; D-12 |
| NEVER AWS SDK v2 | Frameworks Prohibited |
| NEVER SQL by string concatenation | Frameworks Prohibited |
| NEVER user-supplied text in `innerHTML` | Frameworks Prohibited |
| NEVER committed `node_modules/` | Frameworks Prohibited |
| NEVER scripts from public CDNs at runtime | Frameworks Prohibited |
| NEVER cloud credentials or long-lived keys in the browser | Frameworks Prohibited |
| NEVER browser to database directly | Architecture and Patterns ("The browser never talks to the database") |
| NEVER secrets in source, config files or the frontend bundle | Security, Secrets ("Never") |
| NEVER long-lived access keys in the pipeline | Allowed services, IAM row |
| NEVER AWS resources by hand in the console | Allowed services, CloudFormation row ("Nothing created by hand in the console"). The row names CDK, which is marked [confirm] elsewhere; the rule names no tool |
| NEVER mock the database in integration tests | Testing, Mocking ("Never") |
| NEVER AWS App Runner | Disallowed services |
| NEVER hand-managed EC2 instances | Disallowed services |

### Stated by the Owner but Not Listed as Rules

| Statement | Why it is not a rule |
|---|---|
| Parameterised queries (Frameworks Required, `pg`) | Same constraint as "NEVER build SQL by string concatenation" |
| Infrastructure as code kept in the repository | Same constraint as "NEVER create AWS resources by hand in the console" |
| No DynamoDB as the system of record (Disallowed services) | Same constraint as "ALWAYS use PostgreSQL as the system of record" |
| No Firebase SDKs in the application (Frameworks Prohibited) | Covered by "NEVER depend on any Google Cloud or Firebase service at runtime". The same line allows the SDK in the one-off, read-only migration tooling, which is not runtime |
| Versioned migrations with a way back or roll-forward (Data, Schema changes) | A practice; it is in `team-practices.md` under Deployment |
| No NAT gateways "unless justified at Infrastructure Design" (Disallowed services) | Conditional, not absolute; it is a cost question for infrastructure design |
| GPL and AGPL "need approval" (Compliance, Licences) | Conditional, and covered by the library approval rule, whose request states the licence |
| The interview answers (branch, pull requests, thin slice, test-after, 80% of lines, two environments with manual approval) | Practices; they are in `team-practices.md` |

## Interview Decisions

From `practices-discovery-questions.md`. The owner confirmed the summary of
these answers ("Looks correct").

| Question | Answer |
|---|---|
| Q1. Which branch should finished pieces of work be merged into? | A. `aws-migration`, with one merge into `master` when the AWS version is accepted |
| Q2. Should each piece go through a pull request on GitHub before it is merged? | A. Yes, every piece goes through a pull request, and the checks must pass before it merges |
| Q3. Build a thin end-to-end slice first? | A. Yes, build that slice first (the pipeline and infrastructure plus one trivial page, one server call and one database read, deployed to AWS) |
| Q4. When should tests be written? | A. After the code for each layer, before the piece is merged |
| Q5. Should a merge be refused when too little of the code is covered by tests? | A. Yes, at least 80% of lines |
| Q6. After a change passes its checks in a test environment, how does it reach production? | A. It waits for me to approve it by hand (two environments, test and production) |
| Code style (not asked) | Confirmed in the summary: strict TypeScript, ESLint and Prettier with its default settings, enforced in the pipeline |

## Unresolved Uncertainty

1. **Pull requests and the tooling's local merge.** The owner's rule is a pull request on GitHub for every piece. AI-DLC's own tooling lands a piece with a merge on the developer's machine. Nothing here settles how the two fit together; it is for the delivery planning and pipeline stages.
2. **Two environments under the cost ceiling.** Whether a test environment and production fit under about US$50 a month (D-16) depends on how the database is run, which is open (Open Technical Decision 2). To be confirmed at infrastructure design.
3. **What the 80% is measured over.** The owner's answer is "80% of lines". Whether the 2019 code under `app/`, which has no tests and is to be removed, counts until it is removed is not stated.
4. **Merge style.** Not asked. `team-practices.md` states the framework default (one squashed commit for each piece).
5. **Pipeline product.** GitHub hosts the repository and the technical environment asks for OIDC, but no product is named. This belongs to a later stage.
6. **Repository settings on GitHub** (branch protection on `aws-migration`, Dependabot configuration, whether Actions is enabled) were not inspected. The pull request rule can only block a merge once branch protection is set.
7. **Standing of the technical environment.** The document calls itself a draft. Only the statements listed under D-12 are recorded decisions. The other rules in `discovered-rules.md` are taken from unmarked lines of that draft; the owner confirms or removes them at the approval gate.
8. **Overlap with the framework's own rules.** "Validate every API input" and "no secrets in source" are close to two of the framework's construction-phase rules. They are listed because the owner wrote them, in more specific words.
9. **Repository layout** (replace `app/` in place or build beside it) is Open Technical Decision 7, decided in a later stage.
10. **Practices carried without a question of their own.** They are marked as such under each area above. The owner sees them in `team-practices.md` at the approval gate.
